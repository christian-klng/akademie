import { and, count, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { notifyAddress, sendMail } from "@/lib/mail";
import {
  confirmationMail,
  paidWithoutSeatMail,
  waitlistAfterPaymentMail,
} from "@/lib/mail-templates";
import { isReservationActive, occupiesSeat } from "@/lib/reservation";
import {
  PAID_EVENT_TYPES,
  hasStripeSecret,
  verifyStripeSignature,
} from "@/lib/stripe";

// Stripe calls this after a payment. It is the only public write endpoint on
// the site, so nothing here trusts the request until the signature checks out.
// proxy.ts only gates /admin/*, so this path stays reachable.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The slice of the Stripe payload we actually read. */
type StripePayload = {
  type?: string;
  data?: {
    object?: {
      id?: string;
      client_reference_id?: string | null;
      payment_status?: string;
    };
  };
};

export async function POST(request: Request): Promise<Response> {
  if (!hasStripeSecret()) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET ist nicht gesetzt");
    return new Response("not configured", { status: 500 });
  }

  // Must be the raw bytes — re-serialising parsed JSON breaks the signature.
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (
    !verifyStripeSignature(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    )
  ) {
    console.warn("[stripe] Signatur ungültig — Anfrage verworfen");
    return new Response("invalid signature", { status: 400 });
  }

  let payload: StripePayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const type = payload.type ?? "";
  if (!(PAID_EVENT_TYPES as readonly string[]).includes(type)) {
    // Acknowledge everything else, or Stripe keeps retrying it.
    return new Response("ignored", { status: 200 });
  }

  const session = payload.data?.object ?? {};
  const registrationId = session.client_reference_id ?? "";
  if (!registrationId) {
    console.warn(`[stripe] ${type} ohne client_reference_id`);
    return new Response("no reference", { status: 200 });
  }
  // `completed` also fires for sessions that ended unpaid (e.g. a pending
  // bank debit that later fails) — only "paid" means the money is there.
  if (session.payment_status && session.payment_status !== "paid") {
    console.info(
      `[stripe] ${type} für ${registrationId} mit payment_status=${session.payment_status} — ignoriert`,
    );
    return new Response("not paid", { status: 200 });
  }

  const now = new Date();

  // The payment is what turns a held seat into a real sign-up, so this runs in
  // the same shape as the sign-up itself: event row locked, seats counted
  // inside the transaction. Without the lock, a payment arriving after its
  // reservation expired could overbook the event.
  const result = await db.transaction(async (tx) => {
    const [registration] = await tx
      .select()
      .from(schema.registration)
      .where(eq(schema.registration.id, registrationId))
      .limit(1);
    if (!registration) return { kind: "unknown" } as const;

    // Stripe redelivers on any non-2xx and on manual resends. Second time
    // round there is nothing left to do — and no second confirmation mail.
    if (registration.paymentStatus === "bezahlt") {
      return { kind: "duplicate" } as const;
    }

    const [event] = await tx
      .select()
      .from(schema.event)
      .where(eq(schema.event.id, registration.eventId))
      .limit(1)
      .for("update");
    if (!event) return { kind: "unknown" } as const;

    // Is the seat still there? A running reservation counts itself, so paying
    // in time always fits. Past the deadline the seat may have been taken by
    // someone else in the meantime — a late payment is still honoured when
    // nobody took it.
    //
    // "storniert" is the exception: an admin decided this sign-up is off, and
    // a payment must not quietly undo that. The money is recorded, the status
    // stays, and the notice below puts it in front of a human.
    const cancelled = registration.status === "storniert";

    let seatAvailable = false;
    if (!cancelled) {
      if (event.capacity === null || isReservationActive(registration, now)) {
        seatAvailable = true;
      } else {
        const [seats] = await tx
          .select({ n: count() })
          .from(schema.registration)
          .where(
            and(eq(schema.registration.eventId, event.id), occupiesSeat(now)),
          );
        seatAvailable = (seats?.n ?? 0) < event.capacity;
      }
    }

    const [updated] = await tx
      .update(schema.registration)
      .set({
        // Paid without a seat: park it on the waiting list rather than
        // overbook. An admin decides — refund or move someone up.
        status: cancelled
          ? "storniert"
          : seatAvailable
            ? "angemeldet"
            : "warteliste",
        paymentStatus: "bezahlt",
        reservedUntil: null,
        stripeSessionId: session.id ?? "",
        paidAt: now,
        updatedAt: now,
      })
      .where(eq(schema.registration.id, registration.id))
      .returning();

    return {
      kind: "paid",
      event,
      registration: updated,
      seatAvailable,
      cancelled,
    } as const;
  });

  if (result.kind === "unknown") {
    console.warn(`[stripe] Anmeldung ${registrationId} nicht gefunden`);
    return new Response("unknown registration", { status: 200 });
  }
  if (result.kind === "duplicate") {
    return new Response("already paid", { status: 200 });
  }

  const { event, registration, seatAvailable, cancelled } = result;

  if (seatAvailable) {
    console.info(
      `[stripe] ${type}: Anmeldung ${registration.id} bezahlt und bestätigt`,
    );
    await sendMail(confirmationMail(event, registration));
    return new Response("ok", { status: 200 });
  }

  // Loud on purpose: money arrived for a seat we can't hand out.
  console.error(
    `[stripe] ${type}: Anmeldung ${registration.id} bezahlt, aber ${
      cancelled ? "storniert" : `${event.title} ist voll`
    } — bitte prüfen`,
  );
  await sendMail(
    paidWithoutSeatMail(
      notifyAddress(),
      event,
      registration,
      cancelled ? "storniert" : "voll",
    ),
  );
  // Only the "full" case gets an automatic reply: there the person is simply
  // next in line. A cancelled sign-up needs a human, not a template.
  if (!cancelled) await sendMail(waitlistAfterPaymentMail(event, registration));

  return new Response("ok", { status: 200 });
}

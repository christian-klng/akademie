import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { confirmationMail } from "@/lib/mail-templates";
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

  const [registration] = await db
    .select()
    .from(schema.registration)
    .where(eq(schema.registration.id, registrationId))
    .limit(1);

  if (!registration) {
    console.warn(`[stripe] Anmeldung ${registrationId} nicht gefunden`);
    return new Response("unknown registration", { status: 200 });
  }

  // Stripe redelivers on any non-2xx and on manual resends. Second time round
  // there is nothing left to do — and no second confirmation mail.
  if (registration.paymentStatus === "bezahlt") {
    return new Response("already paid", { status: 200 });
  }

  const [updated] = await db
    .update(schema.registration)
    .set({
      paymentStatus: "bezahlt",
      stripeSessionId: session.id ?? "",
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.registration.id, registration.id))
    .returning();

  const [event] = await db
    .select()
    .from(schema.event)
    .where(eq(schema.event.id, registration.eventId))
    .limit(1);

  console.info(
    `[stripe] ${type}: Anmeldung ${registration.id} als bezahlt markiert`,
  );

  if (event) await sendMail(confirmationMail(event, updated));

  return new Response("ok", { status: 200 });
}

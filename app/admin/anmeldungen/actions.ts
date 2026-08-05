"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { countTakenSeats } from "@/lib/queries";
import { PROMOTION_HOLD_MS, reservationDeadline } from "@/lib/reservation";
import { sendMail } from "@/lib/mail";
import { confirmationMail, seatFreeMail } from "@/lib/mail-templates";
import type { Event, Registration } from "@/lib/schema";

// Admin-side edits to a sign-up. Everything here runs behind proxy.ts.
// Results are reported back through a query parameter — these are plain
// <form action={…}> buttons in a server component, so there is no
// useActionState channel to put a message in.

type Loaded = { registration: Registration; event: Event };

async function load(id: string): Promise<Loaded | null> {
  const [registration] = await db
    .select()
    .from(schema.registration)
    .where(eq(schema.registration.id, id))
    .limit(1);
  if (!registration) return null;

  const [event] = await db
    .select()
    .from(schema.event)
    .where(eq(schema.event.id, registration.eventId))
    .limit(1);
  if (!event) return null;

  return { registration, event };
}

function back(eventId: string, hinweis?: string): never {
  const params = new URLSearchParams({ event: eventId });
  if (hinweis) params.set("hinweis", hinweis);
  revalidatePath("/", "layout");
  redirect(`/admin/anmeldungen?${params}`);
}

/** Waiting list → confirmed seat. Refuses to overbook. */
export async function promoteRegistration(id: string): Promise<void> {
  const loaded = await load(id);
  if (!loaded) redirect("/admin/anmeldungen");
  const { registration, event } = loaded;

  if (registration.status !== "warteliste") back(event.id);

  if (event.capacity !== null) {
    const taken = await countTakenSeats(event.id);
    if (taken >= event.capacity) back(event.id, "voll");
  }

  // A paid event hands out a hold, not a seat — same rule as the public sign-up
  // (app/events/[slug]/actions.ts). The window is days rather than minutes:
  // this person is reacting to the mail below, not to their own click.
  //
  // Unless they already paid: that happens when a payment landed after the
  // event had filled up, which parks a paid sign-up on the waiting list
  // (app/api/stripe/webhook/route.ts). Asking them for money a second time
  // would be exactly the wrong move — they go straight to a confirmed seat.
  const alreadyPaid = registration.paymentStatus === "bezahlt";
  const needsPayment = Boolean(event.stripeCheckoutUrl) && !alreadyPaid;
  const now = new Date();

  const [updated] = await db
    .update(schema.registration)
    .set({
      status: needsPayment ? "reserviert" : "angemeldet",
      paymentStatus: alreadyPaid
        ? "bezahlt"
        : needsPayment
          ? "offen"
          : "kostenlos",
      reservedUntil: needsPayment
        ? reservationDeadline(PROMOTION_HOLD_MS, now)
        : null,
      updatedAt: now,
    })
    .where(eq(schema.registration.id, id))
    .returning();

  // The "seat is free" mail carries a payment link; someone who has already
  // paid gets the plain confirmation instead.
  await sendMail(
    alreadyPaid ? confirmationMail(event, updated) : seatFreeMail(event, updated),
  );
  back(event.id, "nachgerueckt");
}

/** Frees the seat. The row stays for the record. */
export async function cancelRegistration(id: string): Promise<void> {
  const loaded = await load(id);
  if (!loaded) redirect("/admin/anmeldungen");

  await db
    .update(schema.registration)
    .set({ status: "storniert", reservedUntil: null, updatedAt: new Date() })
    .where(eq(schema.registration.id, id));

  back(loaded.event.id, "storniert");
}

/** Manual fallback for a payment the webhook missed (e.g. bank transfer). */
export async function markPaid(id: string): Promise<void> {
  const loaded = await load(id);
  if (!loaded) redirect("/admin/anmeldungen");
  const now = new Date();

  const [updated] = await db
    .update(schema.registration)
    .set({
      // Confirms a held seat, exactly like the webhook does. Any other status
      // is left alone: a waiting-list row must not jump the queue just because
      // its payment came in — that is what "Nachrücken lassen" is for.
      ...(loaded.registration.status === "reserviert"
        ? { status: "angemeldet" as const, reservedUntil: null }
        : {}),
      paymentStatus: "bezahlt",
      paidAt: now,
      updatedAt: now,
    })
    .where(eq(schema.registration.id, id))
    .returning();

  await sendMail(confirmationMail(loaded.event, updated));
  back(loaded.event.id, "bezahlt");
}

/** Hard delete — for a GDPR erasure request. */
export async function deleteRegistration(id: string): Promise<void> {
  const loaded = await load(id);
  if (!loaded) redirect("/admin/anmeldungen");

  await db.delete(schema.registration).where(eq(schema.registration.id, id));
  back(loaded.event.id, "geloescht");
}

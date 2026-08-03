"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { countTakenSeats } from "@/lib/queries";
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

  const [updated] = await db
    .update(schema.registration)
    .set({
      status: "angemeldet",
      // A paid event only gets its seat secured once the money arrives; the
      // mail below carries the payment link.
      paymentStatus: event.stripeCheckoutUrl ? "offen" : "kostenlos",
      updatedAt: new Date(),
    })
    .where(eq(schema.registration.id, id))
    .returning();

  await sendMail(seatFreeMail(event, updated));
  back(event.id, "nachgerueckt");
}

/** Frees the seat. The row stays for the record. */
export async function cancelRegistration(id: string): Promise<void> {
  const loaded = await load(id);
  if (!loaded) redirect("/admin/anmeldungen");

  await db
    .update(schema.registration)
    .set({ status: "storniert", updatedAt: new Date() })
    .where(eq(schema.registration.id, id));

  back(loaded.event.id, "storniert");
}

/** Manual fallback for a payment the webhook missed (e.g. bank transfer). */
export async function markPaid(id: string): Promise<void> {
  const loaded = await load(id);
  if (!loaded) redirect("/admin/anmeldungen");

  const [updated] = await db
    .update(schema.registration)
    .set({ paymentStatus: "bezahlt", paidAt: new Date(), updatedAt: new Date() })
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

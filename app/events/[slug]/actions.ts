"use server";

import { redirect } from "next/navigation";
import { and, count, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { readField } from "@/lib/form";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { sendMail, notifyAddress } from "@/lib/mail";
import {
  adminNoticeMail,
  confirmationMail,
  waitlistMail,
} from "@/lib/mail-templates";
import { checkoutUrlFor } from "@/lib/stripe";
import type { Event, Registration } from "@/lib/schema";

export type RegistrationState = { error?: string };

const MAX_NAME = 120;
const MAX_MESSAGE = 2000;
// Generous on purpose: a whole office behind one NAT signing up for the same
// workshop is normal, a bot hammering the form is not.
const LIMIT = 10;
const FENSTER_MS = 10 * 60 * 1000;

// Deliberately loose: the point is to catch typos, not to police addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Outcome =
  | { ok: true; event: Event; registration: Registration }
  | { ok: false; error: string };

export async function registerForEvent(
  _prev: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const slug = readField(formData, "slug").trim();
  const name = readField(formData, "name").trim();
  const email = readField(formData, "email").trim().toLowerCase();
  const message = readField(formData, "message").trim();
  const consent = readField(formData, "consent") === "on";
  const honeypot = readField(formData, "website").trim();

  // Bots fill every field they find. Look successful, store nothing.
  if (honeypot) redirect(`/events/${slug}/danke`);

  if (!name) return { error: "Bitte gib deinen Namen ein." };
  if (name.length > MAX_NAME)
    return { error: "Dein Name ist zu lang. Bitte kürze ihn." };
  if (!EMAIL_RE.test(email))
    return { error: "Bitte gib eine gültige E-Mail-Adresse ein." };
  if (message.length > MAX_MESSAGE)
    return {
      error: `Deine Nachricht ist zu lang. Bitte kürze sie auf ${MAX_MESSAGE} Zeichen.`,
    };
  if (!consent)
    return {
      error: "Bitte bestätige, dass wir deine Daten für die Anmeldung nutzen dürfen.",
    };

  const { allowed, retryAfterS } = rateLimit(
    `anmeldung:${await clientIp()}`,
    LIMIT,
    FENSTER_MS,
  );
  if (!allowed) {
    const minuten = Math.ceil(retryAfterS / 60);
    return {
      error: `Du hast dich gerade mehrfach angemeldet. Bitte warte ${minuten} Minute${minuten === 1 ? "" : "n"}.`,
    };
  }

  // One transaction, with the event row locked: two people clicking at the same
  // moment can't both take the last seat, and a double submit can't create two
  // rows for the same address.
  const outcome: Outcome = await db.transaction(async (tx) => {
    const [event] = await tx
      .select()
      .from(schema.event)
      .where(and(eq(schema.event.slug, slug), eq(schema.event.published, true)))
      .limit(1)
      .for("update");

    if (!event) return { ok: false, error: "Diese Veranstaltung gibt es nicht." };
    if (!event.registrationOpen)
      return { ok: false, error: "Die Anmeldung für dieses Event ist geschlossen." };
    if (event.startsAt.getTime() <= Date.now())
      return { ok: false, error: "Dieses Event hat schon stattgefunden." };

    const [existing] = await tx
      .select({ id: schema.registration.id })
      .from(schema.registration)
      .where(
        and(
          eq(schema.registration.eventId, event.id),
          eq(schema.registration.email, email),
          ne(schema.registration.status, "storniert"),
        ),
      )
      .limit(1);
    if (existing)
      return {
        ok: false,
        error:
          "Mit dieser E-Mail-Adresse bist du schon angemeldet. Schreib uns, wenn etwas nicht stimmt.",
      };

    let full = false;
    if (event.capacity !== null) {
      const [seats] = await tx
        .select({ n: count() })
        .from(schema.registration)
        .where(
          and(
            eq(schema.registration.eventId, event.id),
            eq(schema.registration.status, "angemeldet"),
          ),
        );
      full = (seats?.n ?? 0) >= event.capacity;
    }

    const [registration] = await tx
      .insert(schema.registration)
      .values({
        eventId: event.id,
        name,
        email,
        message,
        status: full ? "warteliste" : "angemeldet",
        // Nobody pays for a waiting-list spot — that only starts once a seat
        // actually opens up (admin "nachrücken").
        paymentStatus:
          !full && event.stripeCheckoutUrl ? "offen" : "kostenlos",
      })
      .returning();

    return { ok: true, event, registration };
  });

  if (!outcome.ok) return { error: outcome.error };

  const { event, registration } = outcome;

  // Mails come after the commit and never block the outcome: the sign-up is
  // saved, a failed mail is logged (lib/mail.ts) and nothing is rolled back.
  if (registration.status === "warteliste") {
    await sendMail(waitlistMail(event, registration));
  } else if (!event.stripeCheckoutUrl) {
    await sendMail(confirmationMail(event, registration));
  }
  await sendMail(adminNoticeMail(notifyAddress(), event, registration));

  // Paid event with a seat: hand the visitor to Stripe. The confirmation mail
  // waits for the webhook (app/api/stripe/webhook/route.ts).
  if (registration.status === "angemeldet" && event.stripeCheckoutUrl) {
    redirect(checkoutUrlFor(event.stripeCheckoutUrl, registration.id, email));
  }

  redirect(
    `/events/${event.slug}/danke?status=${registration.status === "warteliste" ? "warteliste" : "frei"}`,
  );
}

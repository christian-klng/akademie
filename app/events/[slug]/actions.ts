"use server";

import { redirect } from "next/navigation";
import { and, count, eq, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { readField } from "@/lib/form";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { sendMail, notifyAddress } from "@/lib/mail";
import {
  adminNoticeMail,
  confirmationMail,
  waitlistMail,
} from "@/lib/mail-templates";
import {
  CHECKOUT_HOLD_MS,
  occupiesSeat,
  reservationDeadline,
} from "@/lib/reservation";
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

  const now = new Date();

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
    if (event.startsAt.getTime() <= now.getTime())
      return { ok: false, error: "Dieses Event hat schon stattgefunden." };

    // An address is blocked while it holds a seat or waits for one. A cancelled
    // sign-up and an expired reservation block nothing — abandoning the Stripe
    // checkout must not lock someone out of their own event for good.
    const [existing] = await tx
      .select({ id: schema.registration.id })
      .from(schema.registration)
      .where(
        and(
          eq(schema.registration.eventId, event.id),
          eq(schema.registration.email, email),
          or(occupiesSeat(now), eq(schema.registration.status, "warteliste")),
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
          and(eq(schema.registration.eventId, event.id), occupiesSeat(now)),
        );
      full = (seats?.n ?? 0) >= event.capacity;
    }

    // A paid event hands out a hold, not a seat: "reserviert" until Stripe
    // reports the money (app/api/stripe/webhook/route.ts) or the deadline
    // passes. A free event is confirmed right here.
    const paid = Boolean(event.stripeCheckoutUrl);
    const holdsSeat = !full && paid;

    const values = {
      name,
      message,
      status: full ? "warteliste" : paid ? "reserviert" : "angemeldet",
      // Nobody pays for a waiting-list spot — that only starts once a seat
      // actually opens up (admin "nachrücken").
      paymentStatus: holdsSeat ? "offen" : "kostenlos",
      reservedUntil: holdsSeat
        ? reservationDeadline(CHECKOUT_HOLD_MS, now)
        : null,
      updatedAt: now,
    };

    // Coming back after an abandoned checkout rewrites the expired reservation
    // instead of leaving a second row behind. Any reservation found here is
    // expired by definition — a running one would have been caught above.
    // "storniert" is never reused: that is an admin's decision and stays put.
    const [stale] = await tx
      .select({ id: schema.registration.id })
      .from(schema.registration)
      .where(
        and(
          eq(schema.registration.eventId, event.id),
          eq(schema.registration.email, email),
          eq(schema.registration.status, "reserviert"),
        ),
      )
      .limit(1);

    const [registration] = stale
      ? await tx
          .update(schema.registration)
          .set(values)
          .where(eq(schema.registration.id, stale.id))
          .returning()
      : await tx
          .insert(schema.registration)
          .values({ eventId: event.id, email, ...values })
          .returning();

    return { ok: true, event, registration };
  });

  if (!outcome.ok) return { error: outcome.error };

  const { event, registration } = outcome;

  // Mails come after the commit and never block the outcome: the sign-up is
  // saved, a failed mail is logged (lib/mail.ts) and nothing is rolled back.
  // "reserviert" deliberately gets nothing — the visitor is on their way to
  // Stripe, and the confirmation belongs to the payment, not to the attempt.
  if (registration.status === "warteliste") {
    await sendMail(waitlistMail(event, registration));
  } else if (registration.status === "angemeldet") {
    await sendMail(confirmationMail(event, registration));
  }
  await sendMail(adminNoticeMail(notifyAddress(), event, registration));

  // Reserved seat: hand the visitor to Stripe. Everything that makes this a
  // real sign-up happens in the webhook (app/api/stripe/webhook/route.ts).
  if (registration.status === "reserviert") {
    redirect(checkoutUrlFor(event.stripeCheckoutUrl, registration.id, email));
  }

  redirect(
    `/events/${event.slug}/danke?status=${registration.status === "warteliste" ? "warteliste" : "frei"}`,
  );
}

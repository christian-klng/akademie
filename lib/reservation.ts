import { and, eq, gt, or, type SQL } from "drizzle-orm";
import { registration } from "./schema";
import type { Registration } from "./schema";

// Who holds a seat — the one definition, used by every counter in the app.
//
// A paid sign-up does not get a seat right away: it becomes "reserviert" with
// a deadline, goes to Stripe, and only the webhook turns it into "angemeldet".
// An unpaid reservation therefore stops blocking the seat all by itself once
// its deadline passes — there is no cleanup job, an expired row simply drops
// out of the count below.

/**
 * How long a seat is held while someone is in Stripe checkout. Generous on
 * purpose: paying often means switching to a banking app for 3-D Secure.
 */
export const CHECKOUT_HOLD_MS = 30 * 60 * 1000;

/**
 * The same hold for someone moved up from the waiting list. Much longer,
 * because they are reacting to an email, not to their own click.
 */
export const PROMOTION_HOLD_MS = 48 * 60 * 60 * 1000;

export function reservationDeadline(
  holdMs: number,
  now: Date = new Date(),
): Date {
  return new Date(now.getTime() + holdMs);
}

/**
 * SQL filter for the rows that occupy a seat. Works inside a transaction too —
 * the sign-up path counts with the event row locked.
 *
 * `now` is passed in from JS rather than using Postgres `now()`: these are
 * naive `timestamp` columns that drizzle reads and writes as UTC, so the
 * comparison has to follow the same convention as the write.
 */
export function occupiesSeat(now: Date = new Date()): SQL {
  return or(
    eq(registration.status, "angemeldet"),
    and(
      eq(registration.status, "reserviert"),
      gt(registration.reservedUntil, now),
    ),
  )!;
}

/** The display-side counterpart of `occupiesSeat`, for a row already loaded. */
export function isReservationActive(
  reg: Pick<Registration, "status" | "reservedUntil">,
  now: Date = new Date(),
): boolean {
  return (
    reg.status === "reserviert" &&
    reg.reservedUntil !== null &&
    reg.reservedUntil.getTime() > now.getTime()
  );
}

/** A reservation nobody paid for in time — it holds nothing any more. */
export function isReservationExpired(
  reg: Pick<Registration, "status" | "reservedUntil">,
  now: Date = new Date(),
): boolean {
  return reg.status === "reserviert" && !isReservationActive(reg, now);
}

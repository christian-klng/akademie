import { createHmac, timingSafeEqual } from "node:crypto";

// Stripe integration, deliberately without the SDK: the only two things we need
// are a link to send people to and a signature check on the way back. The rest
// of the project talks to third parties over plain fetch too (lib/cortecs.ts).
//
// Flow: the admin pastes a Stripe Payment Link into the event. On sign-up we
// append our registration id as `client_reference_id`; Stripe hands it back in
// the webhook, which is how a payment finds its registration.

/** Stripe accepts letters, digits, "-" and "_" here — a UUID qualifies. */
export function checkoutUrlFor(
  stripeCheckoutUrl: string,
  registrationId: string,
  email: string,
): string {
  const url = new URL(stripeCheckoutUrl);
  url.searchParams.set("client_reference_id", registrationId);
  url.searchParams.set("prefilled_email", email);
  return url.toString();
}

/** Webhook payloads we act on. Everything else is acknowledged and ignored. */
export const PAID_EVENT_TYPES = [
  "checkout.session.completed",
  // SEPA/Sofort settle later; Stripe sends this once the money actually landed.
  "checkout.session.async_payment_succeeded",
] as const;

/** Reject anything older than this — replaying a captured request must fail. */
const TOLERANCE_S = 5 * 60;

export function hasStripeSecret(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

/**
 * Verify a `stripe-signature` header against the RAW request body.
 *
 * Header shape: `t=1719000000,v1=<hex>,v1=<hex>` (more than one v1 while a
 * secret is being rotated). Stripe signs `"<t>.<body>"` with HMAC-SHA256.
 * The body must be the exact bytes received — re-serialising parsed JSON
 * changes it and the signature will never match.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!header || !secret) return false;

  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") timestamp = value;
    else if (key === "v1") signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) return false;

  const sentAtS = Number(timestamp);
  if (!Number.isFinite(sentAtS)) return false;
  if (Math.abs(nowMs / 1000 - sentAtS) > TOLERANCE_S) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest();

  return signatures.some((candidate) => {
    let given: Buffer;
    try {
      given = Buffer.from(candidate, "hex");
    } catch {
      return false;
    }
    // timingSafeEqual throws on a length mismatch, so check that first.
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

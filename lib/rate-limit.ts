// Minimal in-memory sliding-window rate limiter.
//
// Scope and limits, stated plainly: the counters live in the process, so they
// are per instance, reset on redeploy and are bypassable by changing IP. That
// is enough to stop a loop from draining the API budget, and it is not a
// defence against a determined attacker. If this ever needs to be real, it
// belongs in the database or in front of the app.
//
// Kept on globalThis so `next dev`'s module reloading doesn't clear it.

type Bucket = number[];

const store: Map<string, Bucket> = ((
  globalThis as typeof globalThis & { __rateLimit?: Map<string, Bucket> }
).__rateLimit ??= new Map());

export type RateLimitResult = {
  allowed: boolean;
  /** Seconds until the oldest hit falls out of the window. */
  retryAfterS: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  const hits = (store.get(key) ?? []).filter((t) => t > cutoff);

  if (hits.length >= limit) {
    const oldest = hits[0];
    store.set(key, hits);
    return {
      allowed: false,
      retryAfterS: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  hits.push(now);
  store.set(key, hits);

  // Opportunistic cleanup: without it the map grows one entry per IP forever.
  if (store.size > 5000) {
    for (const [k, v] of store) {
      if (v.every((t) => t <= cutoff)) store.delete(k);
    }
  }

  return { allowed: true, retryAfterS: 0 };
}

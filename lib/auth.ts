// Lightweight session auth for the admin area. No Auth.js: an HMAC-signed
// session cookie (SESSION_SECRET). Uses Web Crypto only, so the same helpers
// work in both the Node.js server actions and the proxy (middleware).
// Credential checking against the DB (bcrypt) lives in the login server
// action — this module must stay free of Node-only imports.

export const COOKIE_NAME = "akademie_session";
export const SESSION_TTL_S = 60 * 60 * 24 * 7; // 7 days

const enc = new TextEncoder();

function toB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): Uint8Array<ArrayBuffer> {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const full = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  const bin = atob(full);
  // Back it by an explicit ArrayBuffer so the type satisfies BufferSource for
  // crypto.subtle (a bare `new Uint8Array(n)` infers ArrayBufferLike under strict).
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Build a signed `<payload>.<sig>` session token for the given admin (by email). */
export async function createSession(email: string): Promise<string> {
  const payload = toB64Url(
    enc.encode(
      JSON.stringify({ u: email, exp: Date.now() + SESSION_TTL_S * 1000 }),
    ),
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(payload)),
  );
  return `${payload}.${toB64Url(sig)}`;
}

/** Verify a session token; returns the admin email or null if invalid/expired. */
export async function verifySession(
  token: string | undefined | null,
): Promise<{ u: string } | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      fromB64Url(sig),
      enc.encode(payload),
    );
  } catch {
    return null;
  }
  if (!valid) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64Url(payload)));
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return { u: String(data.u) };
  } catch {
    return null;
  }
}

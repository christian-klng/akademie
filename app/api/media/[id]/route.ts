import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getMedia } from "@/lib/queries";
import { mediaPath } from "@/lib/media";

// Public delivery of an uploaded file.
//
// The Range support is the point of this file. A video served without it can't
// be scrubbed, and Safari/iOS often refuse to play it at all — they ask for a
// byte range first and expect a 206 back.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Parsed = { start: number; end: number } | "invalid" | null;

/**
 * Parse a `Range` header against a known file size.
 * `null` means "no range asked for", "invalid" means 416.
 * Multi-range requests are ignored (allowed by spec) and served whole.
 */
function parseRange(header: string | null, size: number): Parsed {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return header.includes(",") ? null : "invalid";

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return "invalid";

  let start: number;
  let end: number;
  if (!rawStart) {
    // "bytes=-500" — the last 500 bytes.
    const suffix = Number(rawEnd);
    if (suffix <= 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : size - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return "invalid";
  if (start > end || start >= size) return "invalid";
  return { start, end: Math.min(end, size - 1) };
}

async function respond(
  id: string,
  rangeHeader: string | null,
  withBody: boolean,
): Promise<Response> {
  if (!UUID_RE.test(id)) return new Response("not found", { status: 404 });

  const media = await getMedia(id);
  if (!media) return new Response("not found", { status: 404 });

  const path = mediaPath(id);
  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    // Row without a file: the volume was replaced or a delete half-finished.
    console.error(`[media] Datei fehlt für ${id}`);
    return new Response("not found", { status: 404 });
  }

  const base: Record<string, string> = {
    "content-type": media.mimeType,
    "accept-ranges": "bytes",
    // The name is a UUID and the bytes never change, so this can cache forever.
    "cache-control": "public, max-age=31536000, immutable",
  };

  const range = parseRange(rangeHeader, size);

  if (range === "invalid") {
    return new Response(null, {
      status: 416,
      headers: { ...base, "content-range": `bytes */${size}` },
    });
  }

  const { start, end } = range ?? { start: 0, end: size - 1 };
  const length = end - start + 1;
  const headers: Record<string, string> = {
    ...base,
    "content-length": String(length),
  };
  if (range) headers["content-range"] = `bytes ${start}-${end}/${size}`;

  if (!withBody) {
    return new Response(null, { status: range ? 206 : 200, headers });
  }

  const stream = Readable.toWeb(
    createReadStream(path, { start, end }),
  ) as ReadableStream<Uint8Array>;

  return new Response(stream, { status: range ? 206 : 200, headers });
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  return respond(id, request.headers.get("range"), true);
}

// Some players probe with HEAD before touching the file.
export async function HEAD(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  return respond(id, request.headers.get("range"), false);
}

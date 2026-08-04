import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { getMedia, totalMediaBytes } from "@/lib/queries";
import {
  ALLOWED_POSTER,
  ALLOWED_VIDEO,
  deleteFile,
  hasRoomFor,
  maxFileBytes,
  probeVideo,
  saveStream,
} from "@/lib/media";

// Upload endpoint for the admin video area.
//
// A route handler, not a server action: server actions cap the request body at
// 1 MB, and their FormData buffers the whole file in memory. Here the raw body
// IS the file and gets streamed to disk, so a 300 MB upload costs a few KB of
// memory. Metadata rides along in the query string.
//
// It sits under /admin/ on purpose — proxy.ts gates `/admin/:path*`, so the
// session check is already covered. Under /api/ it would be public.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TITLE = 200;

function fail(reason: string, status = 400): Response {
  return Response.json({ error: reason }, { status });
}

export async function POST(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams;
  const kind = params.get("kind") === "poster" ? "poster" : "video";
  const mimeType = (params.get("type") ?? "").toLowerCase();
  const fileName = (params.get("name") ?? "").slice(0, 255).trim();
  const title = (params.get("title") ?? "").slice(0, MAX_TITLE).trim();
  // Posters are stored AND linked in this one request. Doing it in two steps
  // leaves an invisible orphan file behind whenever the second step is lost —
  // nothing lists it, and it still eats disk.
  const attachTo = params.get("attachTo");

  const allowed = kind === "poster" ? ALLOWED_POSTER : ALLOWED_VIDEO;
  if (!allowed[mimeType]) {
    const list = Object.values(allowed).join(", ");
    return fail(
      kind === "poster"
        ? `Dieses Bildformat geht nicht. Erlaubt sind: ${list}.`
        : `Dieses Videoformat geht nicht. Erlaubt sind: ${list}. Wandle das Video vorher in MP4 (H.264) um.`,
    );
  }
  if (!fileName) return fail("Der Dateiname fehlt.");
  if (!request.body) return fail("Es kam keine Datei an.");

  // Check the target BEFORE writing anything — a poster with nowhere to go
  // would be exactly the orphan this parameter exists to prevent.
  const target = attachTo ? await getMedia(attachTo) : null;
  if (attachTo && (!target || target.kind !== "video")) {
    return fail("Das Video zu diesem Standbild gibt es nicht mehr.", 404);
  }

  // content-length is the browser's claim — check it before writing a byte, so
  // an obviously oversized upload is refused instead of half-written. The real
  // limit is enforced again while streaming (saveStream), which is what counts.
  const announced = Number(request.headers.get("content-length") ?? 0);
  const room = await hasRoomFor(
    announced || 1,
    await totalMediaBytes(),
  );
  if (!room.ok) return fail(room.reason, 413);

  const id = randomUUID();
  const saved = await saveStream(id, request.body, maxFileBytes(), announced);
  if (!saved.ok) return fail(saved.reason, 413);

  // Everything arrived — but does it hang together? A half video whose index is
  // missing embeds happily and then refuses to play, so it must never become a
  // row. Posters are left alone: a broken image is visibly broken.
  if (kind === "video") {
    const probe = await probeVideo(id, mimeType);
    if (!probe.ok) {
      await deleteFile(id);
      return fail(probe.reason, 422);
    }
  }

  try {
    const row = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(schema.media)
        .values({
          id,
          title: title || fileName,
          fileName,
          mimeType,
          sizeBytes: saved.bytes,
          kind,
        })
        .returning();

      if (target) {
        await tx
          .update(schema.media)
          .set({ posterId: id })
          .where(eq(schema.media.id, target.id));
        if (target.posterId) {
          await tx
            .delete(schema.media)
            .where(eq(schema.media.id, target.posterId));
        }
      }
      return inserted;
    });

    // Only once the swap is committed — otherwise a rollback would leave the
    // old poster referenced but deleted from disk.
    if (target?.posterId) await deleteFile(target.posterId);

    return Response.json({ id: row.id, title: row.title, bytes: row.sizeBytes });
  } catch (err) {
    // No row means an orphaned file nobody can ever reach — drop it.
    await deleteFile(id);
    console.error("[media] Upload konnte nicht gespeichert werden:", err);
    return fail("Der Upload konnte nicht gespeichert werden.", 500);
  }
}

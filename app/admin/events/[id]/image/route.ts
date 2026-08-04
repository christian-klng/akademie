import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { totalMediaBytes } from "@/lib/queries";
import {
  ALLOWED_IMAGE,
  deleteFile,
  hasRoomFor,
  maxImageBytes,
  saveStream,
} from "@/lib/media";

// Thumbnail upload for one event. Same shape as the video upload
// (app/admin/videos/upload/route.ts): a route handler rather than a server
// action, because those cap the body at 1 MB and buffer it in memory.
//
// Storing the file and linking it to the event happen in ONE request. Split in
// two, a lost second step would leave a file nothing lists and nobody can
// delete — the same trap that the video still frames ran into.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(reason: string, status = 400): Response {
  return Response.json({ error: reason }, { status });
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: eventId } = await ctx.params;
  if (!UUID_RE.test(eventId)) return fail("Dieses Event gibt es nicht.", 404);

  const params = request.nextUrl.searchParams;
  const mimeType = (params.get("type") ?? "").toLowerCase();
  const fileName = (params.get("name") ?? "").slice(0, 255).trim();

  if (!ALLOWED_IMAGE[mimeType]) {
    return fail(
      `Dieses Bildformat geht nicht. Erlaubt sind: ${Object.values(ALLOWED_IMAGE).join(", ")}.`,
    );
  }
  if (!fileName) return fail("Der Dateiname fehlt.");
  if (!request.body) return fail("Es kam keine Datei an.");

  // Check the event exists BEFORE writing anything.
  const [event] = await db
    .select({ id: schema.event.id, imageId: schema.event.imageId })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  if (!event) return fail("Dieses Event gibt es nicht mehr.", 404);

  const announced = Number(request.headers.get("content-length") ?? 0);
  const limit = maxImageBytes();
  const room = await hasRoomFor(announced || 1, await totalMediaBytes(), limit);
  if (!room.ok) return fail(room.reason, 413);

  const id = randomUUID();
  const saved = await saveStream(id, request.body, limit, announced);
  if (!saved.ok) return fail(saved.reason, 413);

  const previous = event.imageId;

  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.media).values({
        id,
        title: fileName,
        fileName,
        mimeType,
        sizeBytes: saved.bytes,
        kind: "image",
      });
      await tx
        .update(schema.event)
        .set({ imageId: id, updatedAt: new Date() })
        .where(eq(schema.event.id, eventId));
      if (previous) {
        await tx.delete(schema.media).where(eq(schema.media.id, previous));
      }
    });
  } catch (err) {
    await deleteFile(id);
    console.error("[media] Event-Bild konnte nicht gespeichert werden:", err);
    return fail("Das Bild konnte nicht gespeichert werden.", 500);
  }

  // Only after the commit — a rollback would otherwise leave the old image
  // still referenced but already gone from disk.
  if (previous) await deleteFile(previous);

  return Response.json({ id, bytes: saved.bytes });
}

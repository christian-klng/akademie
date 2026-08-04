import "server-only";
import { createWriteStream } from "node:fs";
import { mkdir, statfs, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";

// The one place that touches the disk. Everything else goes through here.
//
// Files live on a volume (docker-compose `media-data` → /data/media). The file
// name is always a UUID we generated, never anything from the request — so
// path traversal is ruled out by construction rather than by escaping.

export const ALLOWED_VIDEO: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export const ALLOWED_POSTER: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Never fill the disk to the brim — Postgres shares it. */
const DISK_HEADROOM_BYTES = 1024 * 1024 * 1024;

export function mediaDir(): string {
  return process.env.MEDIA_DIR ?? "/data/media";
}

export function mediaPath(id: string): string {
  // turbopackIgnore keeps the build tracer out of this: the path is resolved at
  // runtime from an env var, and without the hint Turbopack assumes a dynamic
  // require and traces the entire project into the standalone output.
  return join(/*turbopackIgnore: true*/ mediaDir(), id);
}

export function maxFileBytes(): number {
  return Number(process.env.MEDIA_MAX_FILE_MB ?? 300) * 1024 * 1024;
}

export function maxTotalBytes(): number {
  return Number(process.env.MEDIA_MAX_TOTAL_MB ?? 2000) * 1024 * 1024;
}

/** "1,2 GB" / "740 MB" — German decimal comma, for the admin UI. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1).replace(".", ",")} GB`;
  }
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

export type RoomCheck = { ok: true } | { ok: false; reason: string };

/**
 * Is there room for `bytes` more? Checks both our own budget and the actual
 * free space on the volume — the budget alone would not notice a disk that
 * other services filled up.
 */
export async function hasRoomFor(
  bytes: number,
  usedBytes: number,
): Promise<RoomCheck> {
  if (bytes > maxFileBytes()) {
    return {
      ok: false,
      reason: `Die Datei ist zu groß. Erlaubt sind ${formatBytes(maxFileBytes())} pro Video.`,
    };
  }

  if (usedBytes + bytes > maxTotalBytes()) {
    return {
      ok: false,
      reason:
        `Der Speicher reicht nicht: ${formatBytes(usedBytes)} von ` +
        `${formatBytes(maxTotalBytes())} sind belegt. Lösche zuerst ein altes Video.`,
    };
  }

  try {
    await mkdir(mediaDir(), { recursive: true });
    const fs = await statfs(mediaDir());
    const free = fs.bavail * fs.bsize;
    if (free - bytes < DISK_HEADROOM_BYTES) {
      return {
        ok: false,
        reason: `Auf der Festplatte ist zu wenig Platz frei (${formatBytes(free)}).`,
      };
    }
  } catch (err) {
    console.error("[media] Freien Speicher prüfen fehlgeschlagen:", err);
    return { ok: false, reason: "Der Speicherplatz lässt sich gerade nicht prüfen." };
  }

  return { ok: true };
}

export type SaveResult =
  | { ok: true; bytes: number }
  | { ok: false; reason: string };

/**
 * Stream a request body straight to disk, counting bytes as they pass.
 *
 * Deliberately NOT `await request.formData()`: that buffers the whole upload in
 * memory, and a 300 MB video next to Postgres on a 4 GB box is how you get an
 * OOM kill. On any failure the partial file is removed, so a rejected upload
 * never leaves bytes behind.
 */
export async function saveStream(
  id: string,
  body: ReadableStream<Uint8Array>,
  limitBytes: number,
): Promise<SaveResult> {
  await mkdir(mediaDir(), { recursive: true });

  let bytes = 0;
  const counting = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > limitBytes) {
        throw new Error("TOO_LARGE");
      }
      controller.enqueue(chunk);
    },
  });

  try {
    await pipeline(
      // The DOM and node:stream/web ReadableStream types describe the same
      // object here; only their declarations differ.
      Readable.fromWeb(
        body.pipeThrough(counting) as unknown as NodeReadableStream<Uint8Array>,
      ),
      createWriteStream(mediaPath(id)),
    );
    return { ok: true, bytes };
  } catch (err) {
    await deleteFile(id);
    if (err instanceof Error && err.message.includes("TOO_LARGE")) {
      return {
        ok: false,
        reason: `Die Datei ist zu groß. Erlaubt sind ${formatBytes(limitBytes)}.`,
      };
    }
    console.error("[media] Schreiben fehlgeschlagen:", err);
    return { ok: false, reason: "Die Datei konnte nicht gespeichert werden." };
  }
}

/** Remove a file. A missing file is fine — the goal is "it's gone". */
export async function deleteFile(id: string): Promise<void> {
  try {
    await unlink(mediaPath(id));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`[media] Löschen von ${id} fehlgeschlagen:`, err);
    }
  }
}

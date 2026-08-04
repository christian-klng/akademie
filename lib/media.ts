import "server-only";
import { createWriteStream } from "node:fs";
import { mkdir, open, stat, statfs, unlink } from "node:fs/promises";
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
 *
 * `expectedBytes` (the request's content-length) is what makes a HALF upload
 * fail instead of succeed. A dropped connection ends the body stream cleanly
 * from Node's point of view, so without this comparison a truncated video is
 * stored as if all were well — it embeds, shows controls, and plays nothing.
 */
export async function saveStream(
  id: string,
  body: ReadableStream<Uint8Array>,
  limitBytes: number,
  expectedBytes: number,
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

    if (expectedBytes > 0 && bytes !== expectedBytes) {
      await deleteFile(id);
      return {
        ok: false,
        reason:
          `Die Datei kam nur zu ${Math.round((bytes / expectedBytes) * 100)} % an ` +
          `(${formatBytes(bytes)} von ${formatBytes(expectedBytes)}). ` +
          `Die Verbindung ist wohl abgerissen — bitte noch einmal versuchen.`,
      };
    }

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

export type ProbeResult = { ok: true } | { ok: false; reason: string };

/** Runaway guard: a real file has a handful of top-level boxes, not thousands. */
const MAX_BOXES = 2000;

const INCOMPLETE =
  "Die Datei ist unvollständig — der Index am Ende des Videos fehlt. " +
  "Meist ist der Upload abgerissen. Bitte lade sie noch einmal hoch.";

/**
 * Walk the top-level MP4 boxes and check the file hangs together.
 *
 * Only box headers are read (a seek each), so this costs a handful of reads
 * even for a 300 MB file. It catches the two failure modes that produce a
 * player which shows controls and then does nothing when you press play:
 * a box that runs past the end of the file, and a missing `moov` — the index
 * without which no browser can start playback.
 */
async function probeMp4(path: string, size: number): Promise<ProbeResult> {
  // turbopackIgnore as in mediaPath(): a runtime path, not a module reference.
  const handle = await open(/*turbopackIgnore: true*/ path, "r");
  try {
    const header = Buffer.alloc(16);
    let offset = 0;
    let sawFtyp = false;
    let sawMoov = false;

    for (let i = 0; i < MAX_BOXES && offset + 8 <= size; i++) {
      const { bytesRead } = await handle.read(header, 0, 16, offset);
      if (bytesRead < 8) break;

      let boxSize = header.readUInt32BE(0);
      const type = header.toString("latin1", 4, 8);
      let headerSize = 8;

      if (boxSize === 1) {
        if (bytesRead < 16) break;
        boxSize = Number(header.readBigUInt64BE(8));
        headerSize = 16;
      } else if (boxSize === 0) {
        // Legacy "runs to the end of the file".
        boxSize = size - offset;
      }

      // Box types are four printable characters. Anything else means we are
      // not reading an MP4 at all.
      if (!/^[\x20-\x7e]{4}$/.test(type) || boxSize < headerSize) {
        return {
          ok: false,
          reason:
            "Die Datei sieht nicht wie ein MP4-Video aus. Bitte wandle sie in " +
            "MP4 (H.264/AAC) um und lade sie neu hoch.",
        };
      }
      if (offset + boxSize > size) return { ok: false, reason: INCOMPLETE };

      if (type === "ftyp") sawFtyp = true;
      if (type === "moov") sawMoov = true;
      offset += boxSize;
    }

    if (!sawFtyp && !sawMoov) {
      return {
        ok: false,
        reason:
          "Die Datei sieht nicht wie ein MP4-Video aus. Bitte wandle sie in " +
          "MP4 (H.264/AAC) um und lade sie neu hoch.",
      };
    }
    if (!sawMoov) return { ok: false, reason: INCOMPLETE };
    return { ok: true };
  } finally {
    await handle.close();
  }
}

/** WebM/Matroska starts with the EBML magic number. */
async function probeWebm(path: string): Promise<ProbeResult> {
  const handle = await open(/*turbopackIgnore: true*/ path, "r");
  try {
    const magic = Buffer.alloc(4);
    const { bytesRead } = await handle.read(magic, 0, 4, 0);
    if (bytesRead === 4 && magic.equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
      return { ok: true };
    }
    return {
      ok: false,
      reason: "Die Datei sieht nicht wie ein WebM-Video aus.",
    };
  } finally {
    await handle.close();
  }
}

/**
 * Sanity-check a stored video before it becomes a row in the database. A file
 * that fails here would embed fine and refuse to play — much better to say so
 * at upload time than to leave a dead player on the page.
 */
export async function probeVideo(
  id: string,
  mimeType: string,
): Promise<ProbeResult> {
  try {
    const { size } = await stat(/*turbopackIgnore: true*/ mediaPath(id));
    if (size === 0) return { ok: false, reason: INCOMPLETE };
    return mimeType === "video/webm"
      ? probeWebm(mediaPath(id))
      : probeMp4(mediaPath(id), size);
  } catch (err) {
    console.error(`[media] Prüfung von ${id} fehlgeschlagen:`, err);
    return { ok: false, reason: "Die Datei ließ sich nicht prüfen." };
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

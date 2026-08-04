"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { readField } from "@/lib/form";
import { deleteFile } from "@/lib/media";

// Admin edits on uploaded media. The upload itself is a route handler
// (./upload/route.ts) — server actions can't take a 300 MB body.

/** Make this the home page video, clearing whichever one held the spot. */
export async function setHomeVideo(id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.media)
      .set({ showOnHome: false })
      .where(ne(schema.media.id, id));
    await tx
      .update(schema.media)
      .set({ showOnHome: true })
      .where(eq(schema.media.id, id));
  });
  revalidatePath("/", "layout");
}

export async function clearHomeVideo(id: string): Promise<void> {
  await db
    .update(schema.media)
    .set({ showOnHome: false })
    .where(eq(schema.media.id, id));
  revalidatePath("/", "layout");
}

const MAX_TITLE = 200;
const MAX_ALT = 300;

/** Rename a video and write its alt text (the two editable fields). */
export async function updateVideo(id: string, formData: FormData): Promise<void> {
  const title = readField(formData, "title").trim().slice(0, MAX_TITLE);
  const altText = readField(formData, "altText").trim().slice(0, MAX_ALT);

  if (!title) {
    redirect(`/admin/videos?hinweis=titel-fehlt#${id}`);
  }

  await db
    .update(schema.media)
    .set({ title, altText })
    .where(eq(schema.media.id, id));

  revalidatePath("/", "layout");
  redirect(`/admin/videos?hinweis=gespeichert#${id}`);
}

// Attaching a poster lives in the upload route, not here: storing the file and
// linking it has to be one request, or a lost second step leaves an orphan.

/**
 * Delete a video: its poster, both files, and the rows. Events keep existing —
 * `event.videoId` is ON DELETE SET NULL, so they just lose the video.
 */
export async function deleteVideo(id: string): Promise<void> {
  const [video] = await db
    .select()
    .from(schema.media)
    .where(eq(schema.media.id, id))
    .limit(1);
  if (!video) return;

  // Row first: a row without a file 404s, a file without a row is invisible
  // garbage that nobody will ever clean up.
  await db.delete(schema.media).where(eq(schema.media.id, id));
  await deleteFile(id);

  if (video.posterId) {
    await db.delete(schema.media).where(eq(schema.media.id, video.posterId));
    await deleteFile(video.posterId);
  }

  revalidatePath("/", "layout");
}

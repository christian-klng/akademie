"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { readField } from "@/lib/form";

export type PageFormState = { error?: string };

// Static pages can only be edited, never created or deleted — the set
// (impressum/datenschutz/agb) is fixed and seeded by scripts/seed.mjs.
export async function savePage(
  _prev: PageFormState,
  formData: FormData,
): Promise<PageFormState> {
  const slug = readField(formData, "slug").trim();
  const title = readField(formData, "title").trim();
  const body = readField(formData, "body");

  if (!title) return { error: "Bitte gib einen Titel ein." };

  const updated = await db
    .update(schema.staticPage)
    .set({ title, body, updatedAt: new Date() })
    .where(eq(schema.staticPage.slug, slug))
    .returning({ slug: schema.staticPage.slug });
  if (updated.length === 0) return { error: "Diese Seite gibt es nicht." };

  revalidatePath("/", "layout");
  redirect("/admin/pages");
}

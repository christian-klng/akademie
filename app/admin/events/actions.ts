"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { readField } from "@/lib/form";
import { parseDatetimeLocalValue, slugify } from "@/lib/format";
import { deleteFile } from "@/lib/media";
import { countTakenSeats } from "@/lib/queries";

export type EventFormState = { error?: string };

export async function saveEvent(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const id = readField(formData, "id").trim(); // empty → create
  const title = readField(formData, "title").trim();
  const slug = slugify(readField(formData, "slug").trim() || title);
  const teaser = readField(formData, "teaser").trim();
  const body = readField(formData, "body");
  const location = readField(formData, "location").trim();
  const format = readField(formData, "format") === "online" ? "online" : "vor_ort";
  const onlineUrl = readField(formData, "onlineUrl").trim();
  const price = readField(formData, "price").trim();
  const capacityRaw = readField(formData, "capacity").trim();
  const stripeCheckoutUrl = readField(formData, "stripeCheckoutUrl").trim();
  const registrationOpen = readField(formData, "registrationOpen") === "on";
  // Empty select → no video. The FK rejects anything that isn't a real id.
  const videoId = readField(formData, "videoId").trim() || null;
  const startsAt = parseDatetimeLocalValue(readField(formData, "startsAt"));
  const endsAt = parseDatetimeLocalValue(readField(formData, "endsAt"));
  const published = readField(formData, "published") === "on";

  if (!title) return { error: "Bitte gib einen Titel ein." };
  if (!slug)
    return { error: "Bitte gib eine Web-Adresse (Slug) ein, z. B. mein-workshop." };
  if (!startsAt) return { error: "Bitte gib an, wann das Event beginnt." };
  if (endsAt && endsAt <= startsAt)
    return { error: "Das Ende muss nach dem Beginn liegen." };

  // Empty means "unlimited", so only a filled field has to be a sane number.
  let capacity: number | null = null;
  if (capacityRaw) {
    const n = Number(capacityRaw);
    if (!Number.isInteger(n) || n < 1)
      return { error: "Die Zahl der Plätze muss eine ganze Zahl ab 1 sein." };
    capacity = n;
  }

  for (const [value, label] of [
    [onlineUrl, "Der Zugangslink"],
    [stripeCheckoutUrl, "Der Stripe-Zahlungslink"],
  ] as const) {
    if (value && !value.startsWith("https://"))
      return { error: `${label} muss mit https:// beginnen.` };
  }

  // Seats already handed out can't be taken away by editing the number down.
  if (id && capacity !== null) {
    const taken = await countTakenSeats(id);
    if (capacity < taken)
      return {
        error: `Es sind schon ${taken} Plätze vergeben. Weniger als ${taken} Plätze gehen nicht.`,
      };
  }

  // The slug is the public URL — it must stay unique.
  const clash = await db
    .select({ id: schema.event.id })
    .from(schema.event)
    .where(
      id
        ? and(eq(schema.event.slug, slug), ne(schema.event.id, id))
        : eq(schema.event.slug, slug),
    )
    .limit(1);
  if (clash.length > 0)
    return {
      error: `Die Web-Adresse "${slug}" ist schon vergeben. Bitte wähle eine andere.`,
    };

  const values = {
    slug,
    title,
    teaser,
    body,
    location,
    format,
    onlineUrl,
    price,
    capacity,
    stripeCheckoutUrl,
    registrationOpen,
    videoId,
    startsAt,
    endsAt,
    published,
    updatedAt: new Date(),
  };

  if (id) {
    const updated = await db
      .update(schema.event)
      .set(values)
      .where(eq(schema.event.id, id))
      .returning({ id: schema.event.id });
    if (updated.length === 0)
      return { error: "Dieses Event gibt es nicht mehr." };
  } else {
    await db.insert(schema.event).values(values);
  }

  revalidatePath("/", "layout");
  redirect("/admin/events");
}

export async function deleteEvent(id: string): Promise<void> {
  const [event] = await db
    .select({ imageId: schema.event.imageId })
    .from(schema.event)
    .where(eq(schema.event.id, id))
    .limit(1);

  await db.delete(schema.event).where(eq(schema.event.id, id));

  // The thumbnail belongs to this event alone — without this it would stay on
  // the volume forever, listed nowhere. Videos are shared and stay put.
  if (event?.imageId) {
    await db.delete(schema.media).where(eq(schema.media.id, event.imageId));
    await deleteFile(event.imageId);
  }

  revalidatePath("/", "layout");
  redirect("/admin/events");
}

/** Take the thumbnail off an event and delete the file. */
export async function removeEventImage(id: string): Promise<void> {
  const [event] = await db
    .select({ imageId: schema.event.imageId })
    .from(schema.event)
    .where(eq(schema.event.id, id))
    .limit(1);
  if (!event?.imageId) redirect(`/admin/events/${id}`);

  await db
    .update(schema.event)
    .set({ imageId: null, updatedAt: new Date() })
    .where(eq(schema.event.id, id));
  await db.delete(schema.media).where(eq(schema.media.id, event.imageId));
  await deleteFile(event.imageId);

  revalidatePath("/", "layout");
  redirect(`/admin/events/${id}`);
}

import { and, asc, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "./db";
import type { Event, StaticPage } from "./schema";

/**
 * The one event featured on the home page: the next upcoming published event,
 * falling back to the most recent published one (so the section never goes
 * empty just because a date passed).
 */
export async function getFeaturedEvent(): Promise<Event | null> {
  const [upcoming] = await db
    .select()
    .from(schema.event)
    .where(
      and(eq(schema.event.published, true), gte(schema.event.startsAt, new Date())),
    )
    .orderBy(asc(schema.event.startsAt))
    .limit(1);
  if (upcoming) return upcoming;

  const [latest] = await db
    .select()
    .from(schema.event)
    .where(eq(schema.event.published, true))
    .orderBy(desc(schema.event.startsAt))
    .limit(1);
  return latest ?? null;
}

export async function getPublishedEvent(slug: string): Promise<Event | null> {
  const [row] = await db
    .select()
    .from(schema.event)
    .where(and(eq(schema.event.slug, slug), eq(schema.event.published, true)))
    .limit(1);
  return row ?? null;
}

export async function listPublishedEvents(): Promise<Event[]> {
  return db
    .select()
    .from(schema.event)
    .where(eq(schema.event.published, true))
    .orderBy(asc(schema.event.startsAt));
}

export async function getStaticPage(slug: string): Promise<StaticPage | null> {
  const [row] = await db
    .select()
    .from(schema.staticPage)
    .where(eq(schema.staticPage.slug, slug))
    .limit(1);
  return row ?? null;
}

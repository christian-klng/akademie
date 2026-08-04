import { and, asc, count, desc, eq, gte, lt, sum } from "drizzle-orm";
import { db, schema } from "./db";
import type { Event, Media, StaticPage } from "./schema";

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

/** Published events that are still ahead, soonest first. */
export async function listUpcomingEvents(): Promise<Event[]> {
  return db
    .select()
    .from(schema.event)
    .where(
      and(eq(schema.event.published, true), gte(schema.event.startsAt, new Date())),
    )
    .orderBy(asc(schema.event.startsAt));
}

/** Published events whose date has passed, most recent first. */
export async function listPastEvents(): Promise<Event[]> {
  return db
    .select()
    .from(schema.event)
    .where(
      and(eq(schema.event.published, true), lt(schema.event.startsAt, new Date())),
    )
    .orderBy(desc(schema.event.startsAt));
}

/** Seats taken: confirmed sign-ups only, regardless of payment state. */
export async function countTakenSeats(eventId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.registration)
    .where(
      and(
        eq(schema.registration.eventId, eventId),
        eq(schema.registration.status, "angemeldet"),
      ),
    );
  return row?.n ?? 0;
}

export type SeatInfo = {
  /** null = unlimited seats. */
  capacity: number | null;
  taken: number;
  /** null when unlimited. */
  free: number | null;
  isFull: boolean;
};

export async function getSeatInfo(event: Event): Promise<SeatInfo> {
  const taken = await countTakenSeats(event.id);
  if (event.capacity === null) {
    return { capacity: null, taken, free: null, isFull: false };
  }
  const free = Math.max(0, event.capacity - taken);
  return { capacity: event.capacity, taken, free, isFull: free === 0 };
}

/**
 * Whether the public sign-up form should be shown at all: the admin has to
 * leave it open and the event must not have started yet. A full event still
 * shows the form — it just switches to the waiting list.
 */
export function isRegistrationOpen(event: Event): boolean {
  return event.registrationOpen && !hasEventStarted(event);
}

export function hasEventStarted(event: Event): boolean {
  return event.startsAt.getTime() <= Date.now();
}

export async function getMedia(id: string): Promise<Media | null> {
  const [row] = await db
    .select()
    .from(schema.media)
    .where(eq(schema.media.id, id))
    .limit(1);
  return row ?? null;
}

/** Videos for the admin list and the event picker, newest first. */
export async function listVideos(): Promise<Media[]> {
  return db
    .select()
    .from(schema.media)
    .where(eq(schema.media.kind, "video"))
    .orderBy(desc(schema.media.createdAt));
}

/** The one video flagged for the home page, if any. */
export async function getHomeVideo(): Promise<Media | null> {
  const [row] = await db
    .select()
    .from(schema.media)
    .where(
      and(eq(schema.media.kind, "video"), eq(schema.media.showOnHome, true)),
    )
    .limit(1);
  return row ?? null;
}

/** Bytes used by everything on the volume — videos and posters alike. */
export async function totalMediaBytes(): Promise<number> {
  const [row] = await db
    .select({ total: sum(schema.media.sizeBytes) })
    .from(schema.media);
  // sum() is null on an empty table and comes back as a numeric string.
  return Number(row?.total ?? 0);
}

export async function getStaticPage(slug: string): Promise<StaticPage | null> {
  const [row] = await db
    .select()
    .from(schema.staticPage)
    .where(eq(schema.staticPage.slug, slug))
    .limit(1);
  return row ?? null;
}

// Date helpers. Event times round-trip as WALL-CLOCK times: form input is
// parsed in server-local time, drizzle stores/reads UTC, and formatting is
// server-local again (see lib/schema.ts) — so a "09:00" entered in the admin
// form always displays as "09:00", regardless of the server timezone.

const DATE_FMT = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const TIME_FMT = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

/** "Mittwoch, 19. August 2026" */
export function formatEventDate(d: Date): string {
  return DATE_FMT.format(d);
}

/** "09:00–13:00 Uhr" (or "09:00 Uhr" without an end time). */
export function formatEventTime(start: Date, end?: Date | null): string {
  const s = TIME_FMT.format(start);
  return end ? `${s}–${TIME_FMT.format(end)} Uhr` : `${s} Uhr`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format a stored Date for a `<input type="datetime-local">` value. */
export function toDatetimeLocalValue(d: Date | null | undefined): string {
  if (!d) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse a `datetime-local` form value ("2026-08-19T09:00") as wall-clock time. */
export function parseDatetimeLocalValue(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Local-naive ISO string ("2026-08-19T09:00:00") for schema.org dates. */
export function toNaiveIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

/** "19.08.2026" — short date for lists and the "Stand:" line. */
export function formatShortDate(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

const RELATIVE_FMT = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" });

/**
 * "in 12 Minuten", "vor 2 Tagen". Relative on purpose: these are real points in
 * time, not wall-clock times like the event dates above, so an absolute display
 * would read two hours off on the UTC production server.
 */
export function formatRelative(target: Date, now: Date = new Date()): string {
  const diffMs = target.getTime() - now.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 60) return RELATIVE_FMT.format(minutes, "minute");
  const hours = Math.round(diffMs / 3_600_000);
  if (Math.abs(hours) < 24) return RELATIVE_FMT.format(hours, "hour");
  return RELATIVE_FMT.format(Math.round(diffMs / 86_400_000), "day");
}

/** URL slug from a title: lowercase, umlauts transliterated, dashes. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

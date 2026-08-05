import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Download } from "lucide-react";
import { db, schema } from "@/lib/db";
import { formatRelative, formatShortDate } from "@/lib/format";
import { isReservationActive } from "@/lib/reservation";
import { ConfirmSubmit } from "@/components/confirm-submit";
import {
  cancelRegistration,
  deleteRegistration,
  markPaid,
  promoteRegistration,
} from "./actions";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Feedback from the server actions, which redirect back here with ?hinweis=…
const HINWEISE: Record<string, string> = {
  voll: "Es ist kein Platz frei. Storniere zuerst eine Anmeldung.",
  nachgerueckt: "Nachgerückt — die Person hat eine E-Mail bekommen.",
  storniert: "Anmeldung storniert. Der Platz ist wieder frei.",
  bezahlt: "Als bezahlt markiert — die Bestätigung ist raus.",
  geloescht: "Anmeldung gelöscht.",
};

const badge = "rounded-full px-2.5 py-0.5 text-xs font-medium";
const neutralBadge = `${badge} bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400`;

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  angemeldet: {
    label: "Angemeldet",
    className: `${badge} bg-success/15 text-success`,
  },
  warteliste: { label: "Warteliste", className: neutralBadge },
  storniert: {
    label: "Storniert",
    className: `${badge} bg-danger/15 text-danger`,
  },
};

/**
 * "reserviert" reads differently depending on the clock: while the deadline
 * runs it holds a seat, afterwards it holds nothing (lib/reservation.ts).
 */
function statusBadge(
  r: { status: string; reservedUntil: Date | null },
  now: Date,
): { label: string; className: string } {
  if (r.status === "reserviert") {
    return isReservationActive(r, now)
      ? {
          label: "Platz reserviert",
          className: `${badge} bg-warning/25 text-neutral-900 dark:text-warning`,
        }
      : { label: "Reservierung abgelaufen", className: neutralBadge };
  }
  return STATUS_BADGE[r.status] ?? STATUS_BADGE.angemeldet;
}

const actionClass =
  "rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900";

export default async function AnmeldungenPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; hinweis?: string }>;
}) {
  const { event: eventParam, hinweis } = await searchParams;
  // A stray ?event=foo would blow up as a Postgres uuid cast — ignore it.
  const eventId = eventParam && UUID_RE.test(eventParam) ? eventParam : null;

  const events = await db
    .select({
      id: schema.event.id,
      title: schema.event.title,
      startsAt: schema.event.startsAt,
    })
    .from(schema.event)
    .orderBy(desc(schema.event.startsAt));

  const rowsQuery = db
    .select({
      registration: schema.registration,
      eventTitle: schema.event.title,
      eventCapacity: schema.event.capacity,
      eventIsPaid: schema.event.stripeCheckoutUrl,
    })
    .from(schema.registration)
    .innerJoin(schema.event, eq(schema.registration.eventId, schema.event.id))
    .orderBy(desc(schema.registration.createdAt));

  const rows = eventId
    ? await rowsQuery.where(eq(schema.registration.eventId, eventId))
    : await rowsQuery;

  // One timestamp for the whole render, so every row is judged against the
  // same moment.
  const now = new Date();

  const confirmed = rows.filter(
    (r) => r.registration.status === "angemeldet",
  ).length;
  const waiting = rows.filter(
    (r) => r.registration.status === "warteliste",
  ).length;
  const reserved = rows.filter((r) =>
    isReservationActive(r.registration, now),
  ).length;
  // Sign-ups holding a seat without having paid. Since paid events reserve
  // first, this is now mostly older rows and hand-confirmed ones.
  const openPayments = rows.filter(
    (r) =>
      r.registration.status === "angemeldet" &&
      r.registration.paymentStatus === "offen",
  ).length;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Anmeldungen</h1>
        {rows.length > 0 && (
          <Link
            href={`/admin/anmeldungen/export${eventId ? `?event=${eventId}` : ""}`}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Als CSV
          </Link>
        )}
      </div>

      {/* Plain GET form — filtering needs no JavaScript. */}
      <form method="get" className="mt-6 flex flex-wrap items-center gap-2">
        <label htmlFor="event" className="sr-only">
          Veranstaltung
        </label>
        <select
          id="event"
          name="event"
          defaultValue={eventId ?? ""}
          className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-white"
        >
          <option value="">Alle Veranstaltungen</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {formatShortDate(e.startsAt)} — {e.title}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Anzeigen
        </button>
      </form>

      {hinweis && HINWEISE[hinweis] && (
        <p
          className={`mt-4 rounded-lg px-4 py-2.5 text-sm ${
            hinweis === "voll"
              ? "bg-danger/10 text-danger"
              : "bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400"
          }`}
          role="status"
        >
          {HINWEISE[hinweis]}
        </p>
      )}

      <p className="mt-4 text-sm text-neutral-500">
        {confirmed} angemeldet · {waiting} auf der Warteliste
        {reserved > 0 && ` · ${reserved} reserviert`}
        {openPayments > 0 && ` · ${openPayments} Zahlung offen`}
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-neutral-500">
            Hier ist noch niemand angemeldet.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {rows.map(({ registration: r, eventTitle, eventIsPaid }) => {
              const status = statusBadge(r, now);
              return (
                <li key={r.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      <p className="mt-0.5 truncate text-xs text-neutral-500">
                        <a href={`mailto:${r.email}`} className="hover:underline">
                          {r.email}
                        </a>
                      </p>
                      {!eventId && (
                        <p className="mt-1 truncate text-xs text-neutral-500">
                          {eventTitle}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-neutral-500">
                        Angemeldet am {formatShortDate(r.createdAt)}
                        {/* Only while it runs — an expired one says so in its badge. */}
                        {isReservationActive(r, now) &&
                          r.reservedUntil &&
                          ` · Reservierung läuft ${formatRelative(r.reservedUntil, now)} ab`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className={status.className}>{status.label}</span>
                      {(eventIsPaid || r.paymentStatus !== "kostenlos") && (
                        <span
                          className={
                            r.paymentStatus === "bezahlt"
                              ? `${badge} bg-success/15 text-success`
                              : `${badge} bg-danger/15 text-danger`
                          }
                        >
                          {r.paymentStatus === "bezahlt"
                            ? "Bezahlt"
                            : "Zahlung offen"}
                        </span>
                      )}
                    </div>
                  </div>

                  {r.message && (
                    <p className="mt-3 whitespace-pre-line rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
                      {r.message}
                    </p>
                  )}

                  {/* One form per button: nested forms are invalid HTML. */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.status === "warteliste" && (
                      <form action={promoteRegistration.bind(null, r.id)}>
                        <button type="submit" className={actionClass}>
                          Nachrücken lassen
                        </button>
                      </form>
                    )}
                    {/* Confirms a reservation by hand — for a payment the
                        webhook never delivered, or a bank transfer. */}
                    {(r.status === "reserviert" ||
                      r.status === "angemeldet") &&
                      r.paymentStatus === "offen" && (
                        <form action={markPaid.bind(null, r.id)}>
                          <button type="submit" className={actionClass}>
                            Als bezahlt markieren
                          </button>
                        </form>
                      )}
                    {r.status !== "storniert" && (
                      <form action={cancelRegistration.bind(null, r.id)}>
                        <ConfirmSubmit
                          label="Stornieren"
                          pendingLabel="Wird storniert …"
                          confirmText={`Anmeldung von ${r.name} wirklich stornieren?`}
                          className={actionClass}
                        />
                      </form>
                    )}
                    <form action={deleteRegistration.bind(null, r.id)}>
                      <ConfirmSubmit
                        label="Löschen"
                        pendingLabel="Wird gelöscht …"
                        confirmText={`Anmeldung von ${r.name} endgültig löschen? Das kann nicht rückgängig gemacht werden.`}
                        className={`${actionClass} border-danger/40 text-danger hover:bg-danger/10`}
                      />
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

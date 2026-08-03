import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { EventCard } from "@/components/event-card";
import { listPastEvents, listUpcomingEvents } from "@/lib/queries";
import { formatShortDate } from "@/lib/format";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const TITLE = "Veranstaltungen";
const DESCRIPTION =
  "Alle Workshops und Weiterbildungen der Kubikraum Akademie — online und vor Ort.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/events" },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/events`,
    siteName: SITE_NAME,
    locale: "de_DE",
  },
};

export default async function EventsPage() {
  const [upcoming, past] = await Promise.all([
    listUpcomingEvents(),
    listPastEvents(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {TITLE}
        </h1>
        <p className="mt-3 text-lg text-neutral-500">
          Workshops und Weiterbildungen — online und vor Ort. Such dir einen
          Termin aus und melde dich direkt an.
        </p>

        <section aria-labelledby="kommende" className="mt-12">
          <h2
            id="kommende"
            className="text-sm font-medium uppercase tracking-wide text-neutral-500"
          >
            Nächste Termine
          </h2>
          {upcoming.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">
              Gerade ist kein Termin geplant. Schau bald wieder vorbei.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {upcoming.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section aria-labelledby="vergangen" className="mt-12">
            <h2
              id="vergangen"
              className="text-sm font-medium uppercase tracking-wide text-neutral-500"
            >
              Schon gelaufen
            </h2>
            <ul className="mt-4 divide-y divide-neutral-200 border-t border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {past.map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/events/${event.slug}`}
                    className="flex items-baseline justify-between gap-4 py-3 text-sm transition hover:text-neutral-900 dark:hover:text-neutral-100"
                  >
                    <span className="text-neutral-600 dark:text-neutral-400">
                      {event.title}
                    </span>
                    <span className="shrink-0 text-xs text-neutral-500">
                      {formatShortDate(event.startsAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

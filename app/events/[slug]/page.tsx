import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, Mail, MapPin, Ticket } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getPublishedEvent } from "@/lib/queries";
import { renderMarkdown } from "@/lib/markdown";
import {
  formatEventDate,
  formatEventTime,
  toNaiveIso,
} from "@/lib/format";
import { SITE_NAME, SITE_URL, SUPPORT_EMAIL } from "@/lib/site";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublishedEvent(slug);
  if (!event) return {};
  return {
    title: event.title,
    description: event.teaser,
    alternates: { canonical: `/events/${event.slug}` },
    openGraph: {
      type: "website",
      title: event.title,
      description: event.teaser,
      url: `${SITE_URL}/events/${event.slug}`,
      siteName: SITE_NAME,
      locale: "de_DE",
    },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const event = await getPublishedEvent(slug);
  if (!event) notFound();

  // schema.org Event entity so search engines understand the date/place.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.teaser,
    startDate: toNaiveIso(event.startsAt),
    ...(event.endsAt ? { endDate: toNaiveIso(event.endsAt) } : {}),
    ...(event.location
      ? { location: { "@type": "Place", name: event.location } }
      : {}),
    organizer: { "@id": `${SITE_URL}/#organization` },
    url: `${SITE_URL}/events/${event.slug}`,
    inLanguage: "de",
  };

  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    `Anmeldung: ${event.title}`,
  )}`;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <div className="flex flex-col gap-1.5 text-sm text-neutral-500">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
            {formatEventDate(event.startsAt)} ·{" "}
            {formatEventTime(event.startsAt, event.endsAt)}
          </span>
          {event.location && (
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              {event.location}
            </span>
          )}
          {event.price && (
            <span className="inline-flex items-center gap-2">
              <Ticket className="h-4 w-4 shrink-0" aria-hidden />
              {event.price}
            </span>
          )}
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          {event.title}
        </h1>
        {event.teaser && (
          <p className="mt-3 text-lg text-neutral-500">{event.teaser}</p>
        )}

        <div
          className="md-content mt-10"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(event.body) }}
        />

        <div className="mt-12 rounded-xl border border-neutral-300 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
          <h2 className="text-base font-semibold tracking-tight">
            Möchtest du dabei sein?
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Schreib uns einfach eine E-Mail. Wir melden uns schnell bei dir —
            versprochen.
          </p>
          <a
            href={mailto}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            <Mail className="h-4 w-4" aria-hidden />
            Per E-Mail anmelden
          </a>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

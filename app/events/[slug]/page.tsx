import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, Mail, MapPin, Ticket, Users } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  getMedia,
  getPublishedEvent,
  getSeatInfo,
  hasEventStarted,
  isRegistrationOpen,
} from "@/lib/queries";
import { VideoPlayer } from "@/components/video-player";
import { MarkdownContent } from "@/components/markdown-content";
import {
  formatEventDate,
  formatEventTime,
  toNaiveIso,
} from "@/lib/format";
import { SITE_NAME, SITE_URL, SUPPORT_EMAIL } from "@/lib/site";
import { RegistrationForm } from "./registration-form";

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

  const seats = await getSeatInfo(event);
  const registrationOpen = isRegistrationOpen(event);
  const started = hasEventStarted(event);
  const video = event.videoId ? await getMedia(event.videoId) : null;

  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    `Frage zu: ${event.title}`,
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
          {(event.location || event.format === "online") && (
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              {event.location || "Online"}
            </span>
          )}
          {event.price && (
            <span className="inline-flex items-center gap-2">
              <Ticket className="h-4 w-4 shrink-0" aria-hidden />
              {event.price}
            </span>
          )}
          {seats.capacity !== null && registrationOpen && (
            <span className="inline-flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0" aria-hidden />
              {seats.isFull
                ? "Alle Plätze sind vergeben"
                : `Noch ${seats.free} von ${seats.capacity} Plätzen frei`}
            </span>
          )}
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          {event.title}
        </h1>
        {event.teaser && (
          <p className="mt-3 text-lg text-neutral-500">{event.teaser}</p>
        )}

        {video && <VideoPlayer video={video} className="mt-8" />}

        <MarkdownContent markdown={event.body} className="mt-10" />

        <div className="mt-12 rounded-xl border border-neutral-300 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
          {registrationOpen ? (
            <>
              <h2 className="text-base font-semibold tracking-tight">
                {seats.isFull ? "Alle Plätze sind vergeben" : "Möchtest du dabei sein?"}
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                {seats.isFull
                  ? "Trag dich auf die Warteliste ein. Wir melden uns, sobald ein Platz frei wird."
                  : "Melde dich hier an. Du bekommst gleich eine E-Mail von uns."}
              </p>
              <RegistrationForm
                slug={event.slug}
                isFull={seats.isFull}
                isPaid={Boolean(event.stripeCheckoutUrl)}
              />
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold tracking-tight">
                {started ? "Dieser Termin ist vorbei" : "Die Anmeldung ist geschlossen"}
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                Du hast Interesse an diesem Thema? Schreib uns eine E-Mail, dann
                sagen wir dir Bescheid, wenn es einen neuen Termin gibt.
              </p>
              <a
                href={mailto}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                <Mail className="h-4 w-4" aria-hidden />
                E-Mail schreiben
              </a>
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

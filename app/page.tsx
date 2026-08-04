import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { EventCard } from "@/components/event-card";
import { Audience } from "@/components/audience";
import { VideoPlayer } from "@/components/video-player";
import { getFeaturedEvent, getHomeVideo } from "@/lib/queries";

// The home page reads the featured event from the DB on every request. Forced
// dynamic so the build never tries to prerender against the placeholder
// DATABASE_URL baked into the Docker image.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [event, video] = await Promise.all([
    getFeaturedEvent(),
    getHomeVideo(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-col justify-center gap-8 px-6 pb-12 pt-16 sm:min-h-[calc(100vh-8rem)] sm:pt-0">
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Erstelle deine{" "}
            <span className="underline decoration-warning decoration-4 underline-offset-4">
              eigene Software
            </span>{" "}
            – ohne Programmierkenntnisse.
          </h1>
          <p className="text-lg text-neutral-500">
            Die Kubikraum Akademie zeigt dir, wie du KI für deine Arbeit nutzt.
            In einfacher Sprache, Schritt für Schritt.
          </p>
        </div>

        {video && <VideoPlayer video={video} />}

        <section aria-labelledby="next-event">
          <h2
            id="next-event"
            className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500"
          >
            Nächster Termin
          </h2>
          {event ? (
            <EventCard event={event} />
          ) : (
            <p className="rounded-xl border border-dashed border-neutral-300 p-5 text-sm text-neutral-500 dark:border-neutral-700">
              Bald gibt es hier neue Termine. Schau gern wieder vorbei.
            </p>
          )}
          <Link
            href="/events"
            className="mt-4 inline-block text-sm text-neutral-500 underline transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Alle Veranstaltungen ansehen
          </Link>
        </section>
      </main>

      <section className="mx-auto w-full max-w-2xl px-6 pb-24">
        <Audience />
      </section>

      <SiteFooter />
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import type { Event } from "@/lib/schema";
import { formatEventDate, formatEventTime } from "@/lib/format";

// The event card, used on the home page and the /events list. Card chrome
// mirrors the Kubikraum Digital prompt box.
//
// The thumbnail is optional: without one the card looks exactly as it did
// before. `alt=""` on purpose — the title sits right below the picture, so a
// screen reader repeating it would only add noise (WCAG: decorative image).
export function EventCard({ event }: { event: Event }) {
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group block overflow-hidden rounded-xl border border-neutral-300 bg-white shadow-sm transition hover:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:border-white"
    >
      {event.imageId && (
        <div className="relative aspect-video w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900">
          <Image
            src={`/api/media/${event.imageId}`}
            alt=""
            fill
            sizes="(min-width: 672px) 640px, 100vw"
            className="object-cover transition-transform motion-safe:group-hover:scale-[1.02]"
          />
        </div>
      )}

      <div className="p-5">
        <div className="flex flex-col gap-1.5 text-xs text-neutral-500 sm:flex-row sm:items-center sm:gap-4">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {formatEventDate(event.startsAt)} ·{" "}
            {formatEventTime(event.startsAt, event.endsAt)}
          </span>
          {event.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {event.location}
            </span>
          )}
        </div>

        <h3 className="mt-3 text-lg font-semibold tracking-tight">
          {event.title}
        </h3>
        {event.teaser && (
          <p className="mt-1.5 text-sm text-neutral-500">{event.teaser}</p>
        )}

        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-900 dark:text-neutral-100">
          Mehr erfahren
          <ArrowRight
            className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </div>
    </Link>
  );
}

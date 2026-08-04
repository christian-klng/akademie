import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { ExternalLink, Users } from "lucide-react";
import { db, schema } from "@/lib/db";
import { listVideos } from "@/lib/queries";
import { toDatetimeLocalValue } from "@/lib/format";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { MediaUploader } from "@/components/media-uploader";
import { EventForm } from "../event-form";
import { deleteEvent, removeEventImage } from "../actions";

export const dynamic = "force-dynamic";

// UUID check up front: a stray path like /admin/events/foo must 404 instead of
// throwing a Postgres cast error.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const [event] = await db
    .select()
    .from(schema.event)
    .where(eq(schema.event.id, id))
    .limit(1);
  if (!event) notFound();

  const [[{ n: registrations }], videos] = await Promise.all([
    db
      .select({ n: count() })
      .from(schema.registration)
      .where(eq(schema.registration.eventId, event.id)),
    listVideos(),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="truncate text-2xl font-semibold tracking-tight">
          {event.title}
        </h1>
        <div className="flex shrink-0 items-center gap-4 text-sm text-neutral-500">
          <Link
            href={`/admin/anmeldungen?event=${event.id}`}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <Users className="h-3.5 w-3.5" aria-hidden />
            {registrations} Anmeldungen
          </Link>
          {event.published && (
            <Link
              href={`/events/${event.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              Ansehen
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </div>
      </div>

      {/* Its own block, outside the form: the image is saved on upload, not
          when the form is submitted. */}
      <section className="mt-6 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-sm font-medium">Bild</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Erscheint auf der Terminliste, oben auf der Event-Seite und als
          Vorschaubild, wenn jemand den Link teilt. Wird auf 16:9 zugeschnitten —
          quer aufgenommene Bilder passen am besten. Ohne Bild bleibt einfach
          alles wie bisher.
        </p>

        {event.imageId && (
          <div className="relative mt-3 aspect-video w-full max-w-sm overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-900">
            <Image
              src={`/api/media/${event.imageId}`}
              alt=""
              fill
              sizes="384px"
              className="object-cover"
              unoptimized
            />
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <MediaUploader
            kind="image"
            label={event.imageId ? "Bild austauschen" : "Bild hochladen"}
            endpoint={`/admin/events/${event.id}/image`}
          />
          {event.imageId && (
            <form action={removeEventImage.bind(null, event.id)}>
              <ConfirmSubmit
                label="Bild entfernen"
                pendingLabel="Wird entfernt …"
                confirmText="Bild wirklich entfernen? Die Datei wird gelöscht."
                className="rounded-md border border-danger/40 px-3 py-1.5 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50"
              />
            </form>
          )}
        </div>
      </section>

      <div className="mt-6">
        <EventForm
          videos={videos.map((v) => ({ id: v.id, title: v.title }))}
          initial={{
            id: event.id,
            title: event.title,
            slug: event.slug,
            teaser: event.teaser,
            body: event.body,
            location: event.location,
            format: event.format,
            onlineUrl: event.onlineUrl,
            price: event.price,
            capacity: event.capacity === null ? "" : String(event.capacity),
            stripeCheckoutUrl: event.stripeCheckoutUrl,
            registrationOpen: event.registrationOpen,
            videoId: event.videoId ?? "",
            startsAt: toDatetimeLocalValue(event.startsAt),
            endsAt: toDatetimeLocalValue(event.endsAt),
            published: event.published,
          }}
        />
      </div>

      {/* Separate form (nested forms are invalid HTML) for the destructive path. */}
      <form action={deleteEvent.bind(null, event.id)} className="mt-10">
        <ConfirmSubmit
          label="Event löschen"
          pendingLabel="Wird gelöscht …"
          confirmText={
            registrations > 0
              ? `"${event.title}" wirklich löschen? ${registrations} Anmeldungen werden mitgelöscht. Das kann nicht rückgängig gemacht werden.`
              : `"${event.title}" wirklich löschen? Das kann nicht rückgängig gemacht werden.`
          }
          className="rounded-md border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50"
        />
      </form>
    </div>
  );
}

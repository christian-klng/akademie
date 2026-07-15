import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { db, schema } from "@/lib/db";
import { toDatetimeLocalValue } from "@/lib/format";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { EventForm } from "../event-form";
import { deleteEvent } from "../actions";

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

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="truncate text-2xl font-semibold tracking-tight">
          {event.title}
        </h1>
        {event.published && (
          <Link
            href={`/events/${event.slug}`}
            target="_blank"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Ansehen
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>

      <div className="mt-6">
        <EventForm
          initial={{
            id: event.id,
            title: event.title,
            slug: event.slug,
            teaser: event.teaser,
            body: event.body,
            location: event.location,
            price: event.price,
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
          confirmText={`"${event.title}" wirklich löschen? Das kann nicht rückgängig gemacht werden.`}
          className="rounded-md border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50"
        />
      </form>
    </div>
  );
}

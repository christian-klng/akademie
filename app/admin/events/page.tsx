import Link from "next/link";
import { desc } from "drizzle-orm";
import { ChevronRight, Plus } from "lucide-react";
import { db, schema } from "@/lib/db";
import { formatShortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const events = await db
    .select()
    .from(schema.event)
    .orderBy(desc(schema.event.startsAt));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Veranstaltungen
        </h1>
        <Link
          href="/admin/events/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Neues Event
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        {events.length === 0 ? (
          <p className="p-5 text-sm text-neutral-500">
            Noch keine Veranstaltungen. Lege die erste an!
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {events.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/admin/events/${e.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-neutral-50 dark:hover:bg-neutral-900"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{e.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {formatShortDate(e.startsAt)} · /events/{e.slug}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-3">
                    <span
                      className={
                        e.published
                          ? "rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success"
                          : "rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                      }
                    >
                      {e.published ? "Öffentlich" : "Entwurf"}
                    </span>
                    <ChevronRight
                      className="h-4 w-4 text-neutral-400"
                      aria-hidden
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

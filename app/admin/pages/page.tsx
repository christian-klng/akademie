import Link from "next/link";
import { asc } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import { db, schema } from "@/lib/db";
import { formatShortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPagesPage() {
  const pages = await db
    .select()
    .from(schema.staticPage)
    .orderBy(asc(schema.staticPage.slug));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Seiten</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Die festen Seiten der Website: Impressum, Datenschutz und AGB.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {pages.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/admin/pages/${p.slug}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    /{p.slug} · Stand: {formatShortDate(p.updatedAt)}
                  </p>
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-neutral-400"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getStaticPage } from "@/lib/queries";
import { renderMarkdown } from "@/lib/markdown";
import { formatShortDate } from "@/lib/format";

// Shared renderer for the DB-backed legal pages (impressum/datenschutz/agb).
// Layout mirrors the Kubikraum Digital legal pages: a narrow reading column
// with sectioned content and a trailing "Stand:" line from updatedAt.
export async function LegalPage({ slug }: { slug: string }) {
  const page = await getStaticPage(slug);
  if (!page) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>

        <div className="mt-10 space-y-8">
          <div
            className="md-content"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(page.body) }}
          />
          <p className="text-xs text-neutral-400">
            Stand: {formatShortDate(page.updatedAt)}
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

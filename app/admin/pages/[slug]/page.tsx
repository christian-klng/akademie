import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getStaticPage } from "@/lib/queries";
import { PageForm } from "../page-form";

export const dynamic = "force-dynamic";

export default async function EditStaticPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getStaticPage(slug);
  if (!page) notFound();

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="truncate text-2xl font-semibold tracking-tight">
          {page.title}
        </h1>
        <Link
          href={`/${page.slug}`}
          target="_blank"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          Ansehen
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <div className="mt-6">
        <PageForm slug={page.slug} title={page.title} body={page.body} />
      </div>
    </div>
  );
}

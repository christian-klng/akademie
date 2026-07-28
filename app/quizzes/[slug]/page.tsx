import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { QuizRunner } from "@/components/quiz/quiz-runner";
import { getKategorie, quizKategorien } from "@/lib/quizzes";

// Next 16: params is a Promise and must be awaited.
type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return quizKategorien.map((k) => ({ slug: k.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const kategorie = getKategorie(slug);
  if (!kategorie) return {};
  return { title: kategorie.titel, description: kategorie.teaser };
}

export default async function QuizKategoriePage({ params }: Props) {
  const { slug } = await params;
  const kategorie = getKategorie(slug);
  if (!kategorie) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <QuizRunner kategorie={kategorie} />
      </main>

      <SiteFooter />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ListChecks } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { quizKategorien } from "@/lib/quizzes";

// No DB access here — the categories live in code, so this page can stay
// static (no force-dynamic needed).
export const metadata: Metadata = {
  title: "Quizzes",
  description:
    "Übe in kleinen Quizzes, was du über KI und Software gelernt hast — Schritt für Schritt und in einfacher Sprache.",
};

export default function QuizzesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Quizzes</h1>
        <p className="mt-3 text-neutral-500">
          Hier übst du selbst. Du bekommst eine Aufgabe, schreibst deine Antwort
          und siehst sofort, was schon gut ist und was noch fehlt.
        </p>

        <ul className="mt-10 space-y-4">
          {quizKategorien.map((kategorie) => (
            <li key={kategorie.slug}>
              <Link
                href={`/quizzes/${kategorie.slug}`}
                className="group block rounded-xl border border-neutral-300 bg-white p-5 shadow-sm transition hover:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:border-white"
              >
                <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
                  <ListChecks className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {kategorie.fragen.length} Fragen
                </span>

                <h2 className="mt-3 text-lg font-semibold tracking-tight">
                  {kategorie.titel}
                </h2>
                <p className="mt-1.5 text-sm text-neutral-500">
                  {kategorie.teaser}
                </p>

                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Quiz starten
                  <ArrowRight
                    className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <SiteFooter />
    </div>
  );
}

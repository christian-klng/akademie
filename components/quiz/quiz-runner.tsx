"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { QuizKategorie } from "@/lib/quizzes/types";
import { QuizQuestion } from "./quiz-question";
import { QuizResult } from "./quiz-result";

type Phase = "intro" | "frage" | "ergebnis";

// Holds the whole run: which phase, which question, and how many were right
// on the first try. Nothing is persisted — a reload starts over, which is fine
// for a practice quiz and keeps us out of user accounts.
export function QuizRunner({ kategorie }: { kategorie: QuizKategorie }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [richtig, setRichtig] = useState(0);

  const anzahl = kategorie.fragen.length;

  function weiter(warRichtig: boolean) {
    if (warRichtig) setRichtig((n) => n + 1);
    if (index + 1 < anzahl) {
      setIndex((i) => i + 1);
    } else {
      setPhase("ergebnis");
    }
  }

  function neustart() {
    setIndex(0);
    setRichtig(0);
    setPhase("frage");
  }

  if (phase === "intro") {
    return (
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {kategorie.titel}
        </h1>
        <p className="mt-3 text-neutral-500">{kategorie.beschreibung}</p>

        <p className="mt-6 text-sm text-neutral-500">{anzahl} Fragen</p>

        <button
          type="button"
          onClick={() => setPhase("frage")}
          className="mt-8 inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Quiz starten
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>

        <p className="mt-10 text-sm">
          <Link href="/quizzes" className="text-neutral-500 underline">
            Zurück zu den Quizzes
          </Link>
        </p>
      </div>
    );
  }

  if (phase === "ergebnis") {
    return (
      <QuizResult
        anzahl={anzahl}
        richtig={richtig}
        onNeustart={neustart}
      />
    );
  }

  const frage = kategorie.fragen[index];
  return (
    <QuizQuestion
      // Remount per question so useActionState starts fresh each time.
      key={frage.id}
      slug={kategorie.slug}
      frage={frage}
      nummer={index + 1}
      anzahl={anzahl}
      onWeiter={weiter}
    />
  );
}

"use client";

import Link from "next/link";
import { PartyPopper } from "lucide-react";

// Closing screen. The score is informational only — the tone stays positive
// either way, the audience is beginners.
export function QuizResult({
  anzahl,
  richtig,
  onNeustart,
}: {
  anzahl: number;
  richtig: number;
  onNeustart: () => void;
}) {
  return (
    <div className="text-center">
      <PartyPopper
        className="mx-auto h-10 w-10 text-success"
        aria-hidden
      />

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Geschafft!</h1>
      <p className="mt-3 text-neutral-500">
        Du hast alle {anzahl} Fragen bearbeitet. Davon auf Anhieb richtig:{" "}
        {richtig} von {anzahl}.
      </p>
      <p className="mt-3 text-neutral-500">
        Am meisten lernst du, wenn du die Techniken gleich im nächsten Chat
        ausprobierst.
      </p>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onNeustart}
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 sm:w-auto dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Nochmal üben
        </button>
        <Link
          href="/quizzes"
          className="w-full rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 sm:w-auto dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Zu den Quizzes
        </Link>
      </div>
    </div>
  );
}

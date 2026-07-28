"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import type { QuizFrage } from "@/lib/quizzes/types";
import {
  bewerteAntwort,
  type BewertungState,
} from "@/app/quizzes/[slug]/actions";

const initialState: BewertungState = {};

type Props = {
  slug: string;
  frage: QuizFrage;
  nummer: number;
  anzahl: number;
  onWeiter: (warRichtig: boolean) => void;
};

export function QuizQuestion({
  slug,
  frage,
  nummer,
  anzahl,
  onWeiter,
}: Props) {
  const [state, formAction, pending] = useActionState(
    bewerteAntwort,
    initialState,
  );
  const [loesungOffen, setLoesungOffen] = useState(false);

  const bewertung = state.bewertung;
  const letzteFrage = nummer === anzahl;

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>
          Frage {nummer} von {anzahl}
        </span>
        <span>{frage.technik}</span>
      </div>
      <div
        className="mt-2 h-1 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
        role="progressbar"
        aria-valuenow={nummer}
        aria-valuemin={1}
        aria-valuemax={anzahl}
      >
        <div
          className="h-full bg-neutral-900 transition-all dark:bg-white"
          style={{ width: `${(nummer / anzahl) * 100}%` }}
        />
      </div>

      <h1 className="mt-8 text-2xl font-semibold tracking-tight">
        {frage.titel}
      </h1>
      <p className="mt-2 text-sm text-neutral-500">{frage.technikSatz}</p>

      <p className="mt-6 rounded-xl border border-neutral-300 bg-white p-5 text-sm shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
        {frage.instruktion}
      </p>

      <form action={formAction} className="mt-6">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="frageId" value={frage.id} />

        <label htmlFor="antwort" className="text-sm font-medium">
          Dein Prompt
        </label>
        <textarea
          id="antwort"
          name="antwort"
          rows={6}
          maxLength={2000}
          required
          readOnly={Boolean(bewertung)}
          autoFocus
          className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 read-only:opacity-70 dark:border-neutral-700 dark:focus:border-white"
        />
        <p className="mt-1.5 text-xs text-neutral-500">
          Deine Antwort wird zur Bewertung an einen KI-Dienst in der EU
          geschickt. Schreib hier bitte keine persönlichen Daten hinein.
        </p>

        {state.error && (
          <p className="mt-3 text-sm text-danger" role="alert">
            {state.error}
          </p>
        )}

        {!bewertung && (
          <button
            type="submit"
            disabled={pending}
            className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {pending ? "Einen Moment …" : "Antwort prüfen"}
          </button>
        )}
      </form>

      {bewertung && (
        <div className="mt-6 rounded-xl border border-neutral-300 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
              bewertung.korrekt
                ? "bg-success/15 text-success"
                : "bg-warning/20 text-info-deep dark:text-warning"
            }`}
          >
            {bewertung.korrekt ? "Richtig" : "Noch nicht ganz"}
          </span>

          <ul className="mt-4 space-y-2 text-sm">
            {bewertung.kriterien.map((k) => (
              <li key={k.name} className="flex items-start gap-2">
                {k.erfuellt ? (
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-success"
                    aria-hidden
                  />
                ) : (
                  <X
                    className="mt-0.5 h-4 w-4 shrink-0 text-danger"
                    aria-hidden
                  />
                )}
                <span className={k.erfuellt ? "" : "text-neutral-500"}>
                  {k.name}
                  <span className="sr-only">
                    {k.erfuellt ? " — erfüllt" : " — noch nicht erfüllt"}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-sm">{bewertung.kommentar}</p>
          <p className="mt-2 text-sm text-neutral-500">
            <span className="font-medium">Tipp: </span>
            {bewertung.tipp}
          </p>

          <button
            type="button"
            onClick={() => setLoesungOffen((o) => !o)}
            className="mt-4 text-sm text-neutral-500 underline"
            aria-expanded={loesungOffen}
          >
            {loesungOffen ? "Beispiel-Lösung ausblenden" : "Beispiel-Lösung ansehen"}
          </button>
          {loesungOffen && (
            <p className="mt-2 rounded-lg bg-neutral-100 p-3 text-sm whitespace-pre-line dark:bg-neutral-900">
              {frage.beispielLoesung}
            </p>
          )}

          <button
            type="button"
            onClick={() => onWeiter(bewertung.korrekt)}
            className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {letzteFrage ? "Ergebnis ansehen" : "Weiter"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

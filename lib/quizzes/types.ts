// Shared types for the quiz feature. Deliberately free of any server-side
// import so client components can use them.

/** One criterion of the evaluation, as returned by the model. */
export type Kriterium = {
  name: string;
  erfuellt: boolean;
};

/** The structured verdict for a single answer. */
export type Bewertung = {
  korrekt: boolean;
  kriterien: Kriterium[];
  kommentar: string;
  tipp: string;
};

/**
 * The public half of a question: everything the browser is allowed to see.
 * The evaluation prompt lives in lib/quizzes/evaluation.ts (server only),
 * linked by `id`.
 */
export type QuizFrage = {
  id: string;
  nr: number;
  titel: string;
  technik: string;
  instruktion: string;
  technikSatz: string;
  beispielLoesung: string;
};

export type QuizKategorie = {
  slug: string;
  titel: string;
  teaser: string;
  /** Shown on the intro screen, one or two sentences. */
  beschreibung: string;
  fragen: QuizFrage[];
};

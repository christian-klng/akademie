import type { QuizKategorie } from "./types";
import { promptTechniken } from "./prompt-techniken";

// Registry of quiz categories. A new category is one data module plus one
// entry here — the /quizzes list and the [slug] route pick it up automatically.
export const quizKategorien: QuizKategorie[] = [promptTechniken];

export function getKategorie(slug: string): QuizKategorie | undefined {
  return quizKategorien.find((k) => k.slug === slug);
}

export function getFrage(slug: string, frageId: string) {
  return getKategorie(slug)?.fragen.find((f) => f.id === frageId);
}

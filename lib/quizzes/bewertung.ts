import type { Bewertung } from "./types";

// Turns the model's raw JSON into a Bewertung, or null if it isn't usable.
//
// Lives in its own module rather than in the server action: a "use server"
// file may only export async functions, so a helper there cannot be exported
// (and therefore cannot be exercised on its own).
//
// Two deliberate choices about trust:
//  - Criterion NAMES come from our own list, by index. The model supplies only
//    the booleans, so a model that paraphrases or translates a name cannot
//    corrupt the checklist the learner sees.
//  - `korrekt` is recomputed from the criteria instead of being taken from the
//    model, so the badge can never contradict the ticks below it.
export function baueBewertung(
  daten: unknown,
  namen: readonly string[],
): Bewertung | null {
  if (typeof daten !== "object" || daten === null) return null;
  const d = daten as Record<string, unknown>;

  if (typeof d.kommentar !== "string" || typeof d.tipp !== "string") return null;
  if (!d.kommentar.trim() || !d.tipp.trim()) return null;

  const rohKriterien = d.kriterien;
  if (!Array.isArray(rohKriterien) || rohKriterien.length !== namen.length) {
    return null;
  }

  const kriterien = namen.map((name, i) => {
    const roh: unknown = rohKriterien[i];
    const erfuellt =
      typeof roh === "object" &&
      roh !== null &&
      (roh as Record<string, unknown>).erfuellt === true;
    return { name, erfuellt };
  });

  return {
    korrekt: kriterien.every((k) => k.erfuellt),
    kriterien,
    kommentar: d.kommentar,
    tipp: d.tipp,
  };
}

"use server";

import { readField } from "@/lib/form";
import { getFrage } from "@/lib/quizzes";
import { getAuswertung, USER_MESSAGE_TEMPLATE } from "@/lib/quizzes/evaluation";
import { holeBewertung, hatCortecsKey } from "@/lib/cortecs";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { baueBewertung } from "@/lib/quizzes/bewertung";
import type { Bewertung } from "@/lib/quizzes/types";

export type BewertungState = {
  bewertung?: Bewertung;
  error?: string;
};

const MAX_ANTWORT_LAENGE = 2000;
const LIMIT = 20;
const FENSTER_MS = 10 * 60 * 1000;

export async function bewerteAntwort(
  _prev: BewertungState,
  formData: FormData,
): Promise<BewertungState> {
  const slug = readField(formData, "slug");
  const frageId = readField(formData, "frageId");
  const antwort = readField(formData, "antwort").trim();

  const frage = getFrage(slug, frageId);
  const auswertung = getAuswertung(frageId);
  if (!frage || !auswertung) {
    return { error: "Diese Frage gibt es nicht." };
  }

  // Cheap guards first — never spend a token on input we already reject.
  if (!antwort) {
    return { error: "Schreib zuerst eine Antwort." };
  }
  if (antwort.length > MAX_ANTWORT_LAENGE) {
    return {
      error: `Deine Antwort ist zu lang. Bitte kürze sie auf ${MAX_ANTWORT_LAENGE} Zeichen.`,
    };
  }
  if (!hatCortecsKey()) {
    return { error: "Das Quiz ist gerade nicht verfügbar." };
  }

  const { allowed, retryAfterS } = rateLimit(
    `quiz:${await clientIp()}`,
    LIMIT,
    FENSTER_MS,
  );
  if (!allowed) {
    const minuten = Math.ceil(retryAfterS / 60);
    return {
      error: `Du hast gerade viele Antworten geprüft. Bitte warte ${minuten} Minute${minuten === 1 ? "" : "n"}.`,
    };
  }

  const userContent = USER_MESSAGE_TEMPLATE.replace("{{user_input}}", antwort);
  const ergebnis = await holeBewertung(auswertung.systemPrompt, userContent);

  // Which branch produced this is the one thing the post-deploy smoke test
  // needs to see. The answer itself is deliberately not logged.
  console.info(
    `[quiz] ${slug}/${frageId} model=${process.env.CORTECS_MODEL || "claude-haiku-4-5"} zweig=${ergebnis.zweig}`,
  );

  if (!ergebnis.ok) {
    return { error: "Die Bewertung hat gerade nicht geklappt. Versuch es nochmal." };
  }

  const bewertung = baueBewertung(ergebnis.daten, auswertung.kriterienNamen);
  if (!bewertung) {
    // Log the shape only. The model's verdict paraphrases the learner's
    // answer, so printing it would put user text into the container logs.
    console.error(
      "[quiz] Unerwartete Antwortstruktur, Felder:",
      typeof ergebnis.daten === "object" && ergebnis.daten !== null
        ? Object.keys(ergebnis.daten).join(",")
        : typeof ergebnis.daten,
    );
    return { error: "Die Bewertung hat gerade nicht geklappt. Versuch es nochmal." };
  }

  return { bewertung };
}

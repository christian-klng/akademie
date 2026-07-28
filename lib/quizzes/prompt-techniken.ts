import type { QuizKategorie } from "./types";

// The "Prompt Techniken" question set. Content follows the canvas list
// "Die 10 meistdiskutierten Prompting-Techniken", strict variant — only
// techniques a beginner can type straight into a chat box, no tooling.
// Order is didactic (easy first), not by citation rank.
//
// This module is bundled into the browser. It must NOT contain the
// evaluation prompts — those live in ./evaluation.ts behind "server-only".
export const promptTechniken: QuizKategorie = {
  slug: "prompt-techniken",
  titel: "Prompt Techniken",
  teaser:
    "Zehn Übungen zu den Techniken, mit denen du bessere Antworten aus einem KI-Chat bekommst.",
  beschreibung:
    "Du schreibst zu jeder Aufgabe selbst einen Prompt. Danach schaut eine KI drauf und sagt dir, was schon gut ist und was noch fehlt. Es gibt kein Richtig oder Falsch beim Thema — es geht nur darum, ob du die Technik angewendet hast.",
  fragen: [
    {
      id: "instruction-prompting",
      nr: 1,
      titel: "Sag genau, was du willst",
      technik: "Instruction Prompting (klare Anweisung)",
      instruktion:
        "Schreibe eine Anweisung für eine Absage-E-Mail an einen Kunden. Sag darin: was das Modell tun soll, wie lang es werden soll und in welchem Ton.",
      technikSatz:
        "Beim Instruction Prompting sagst du dem Modell in einem klaren Auftrag genau, was es tun soll — ohne Beispiele.",
      beispielLoesung:
        "Schreibe eine höfliche E-Mail an einen Kunden, in der ich den Termin am Donnerstag absage und zwei neue Termine vorschlage. Maximal 120 Wörter, freundlicher und sachlicher Ton.",
    },
    {
      id: "role-play-persona",
      nr: 2,
      titel: "Gib dem Modell eine Rolle",
      technik: "Role-Play / Persona",
      instruktion:
        "Schreibe einen Prompt, der dem Modell zuerst eine passende Rolle gibt und dann eine Aufgabe stellt.",
      technikSatz:
        "Beim Role-Play (Persona) sagst du dem Modell, wer es sein soll, damit es aus dieser Sicht und mit diesem Wortschatz antwortet.",
      beispielLoesung:
        "Du bist eine erfahrene Ernährungsberaterin. Erkläre mir in einfachen Worten, worauf ich auf einer Zutatenliste achten sollte, wenn ich weniger Zucker essen will.",
    },
    {
      id: "few-shot",
      nr: 3,
      titel: "Zeig zwei Beispiele",
      technik: "Few-Shot (Lernen an Beispielen im Prompt)",
      instruktion:
        'Das Modell soll Kundenfeedback als "positiv" oder "negativ" einsortieren. Schreibe einen Prompt mit mindestens zwei fertigen Beispielen und hänge am Ende einen dritten Fall ohne Antwort an.',
      technikSatz:
        "Bei Few-Shot zeigst du zwei bis fünf fertige Beispiele im gewünschten Muster, und das Modell macht bei deinem offenen Fall genauso weiter.",
      beispielLoesung: `Sortiere das Feedback als positiv oder negativ ein.

Feedback: Lieferung kam zwei Tage zu spät. -> negativ
Feedback: Super Beratung, sehr freundlich. -> positiv
Feedback: Das Produkt ist okay, aber der Preis ist zu hoch. ->`,
    },
    {
      id: "zero-shot-cot",
      nr: 4,
      titel: "Lass laut denken",
      technik: "Zero-Shot-CoT (Denken Schritt für Schritt, ohne Beispiel)",
      instruktion:
        "Stelle eine kleine Rechenaufgabe aus dem Alltag und hänge einen Satz an, der das Modell zum schrittweisen Denken auffordert.",
      technikSatz:
        'Beim Zero-Shot-CoT (Chain-of-Thought ohne Beispiel) bringt ein Satz wie "Denke Schritt für Schritt" das Modell dazu, den Rechenweg auszuschreiben, statt sofort zu raten.',
      beispielLoesung:
        "Ich kaufe jeden Werktag einen Kaffee für 3,20 Euro und zweimal pro Woche zusätzlich ein Brot für 2,50 Euro. Was gebe ich in vier Wochen aus? Denke Schritt für Schritt.",
    },
    {
      id: "chain-of-thought",
      nr: 5,
      titel: "Zeig den Rechenweg vor",
      technik: "Chain-of-Thought (Gedankenkette mit Beispiel)",
      instruktion:
        "Schreibe ein Beispiel, in dem du eine Aufgabe Schritt für Schritt vorlöst, und hänge danach eine neue, ungelöste Aufgabe an.",
      technikSatz:
        "Bei Chain-of-Thought zeigst du an einem Beispiel, wie der Lösungsweg aussieht, und das Modell übernimmt diese Art zu denken für deine neue Aufgabe.",
      beispielLoesung: `Aufgabe: Ein Zug fährt 90 Minuten mit 80 km/h. Wie weit kommt er?
Lösung: 90 Minuten sind 1,5 Stunden. 1,5 mal 80 sind 120. Antwort: 120 km.

Aufgabe: Ein Radfahrer fährt 45 Minuten mit 24 km/h. Wie weit kommt er?
Lösung:`,
    },
    {
      id: "self-ask",
      nr: 6,
      titel: "Lass Zwischenfragen stellen",
      technik: "Self-Ask (Modell fragt sich selbst)",
      instruktion:
        "Stelle eine Frage, die nur über einen Umweg zu beantworten ist, und fordere das Modell auf, sich selbst Zwischenfragen zu stellen und zu beantworten.",
      technikSatz:
        "Bei Self-Ask soll sich das Modell erst selbst die nötigen Zwischenfragen stellen und beantworten, bevor es die eigentliche Antwort gibt.",
      beispielLoesung:
        "Wer war länger im Amt: der zweite Bundeskanzler oder der vierte? Stelle dir zuerst die nötigen Zwischenfragen und beantworte sie einzeln. Gib danach die eigentliche Antwort.",
    },
    {
      id: "least-to-most",
      nr: 7,
      titel: "Vom Kleinen zum Großen",
      technik: "Least-to-Most (Zerlegen und der Reihe nach lösen)",
      instruktion:
        "Nimm eine größere Aufgabe und schreibe einen Prompt, der sie erst in Teilaufgaben zerlegt und diese dann nacheinander löst — jede Teillösung baut auf der vorigen auf.",
      technikSatz:
        "Bei Least-to-Most zerlegt das Modell ein großes Problem erst in kleinere Teilprobleme und löst sie dann der Reihe nach, wobei jede Antwort in die nächste einfließt.",
      beispielLoesung:
        "Ich will einen Geburtstag für 20 Leute mit 300 Euro Budget planen. Zerlege die Aufgabe zuerst in kleinere Teilaufgaben. Löse die Teilaufgaben dann der Reihe nach und nutze das Ergebnis der vorigen Teilaufgabe jeweils für die nächste.",
    },
    {
      id: "plan-and-solve",
      nr: 8,
      titel: "Erst planen, dann machen",
      technik: "Plan-and-Solve",
      instruktion:
        "Schreibe einen Prompt, der das Modell zuerst einen Plan aufschreiben lässt und ihn danach ausführt — in dieser Reihenfolge.",
      technikSatz:
        "Bei Plan-and-Solve schreibt das Modell zuerst einen Plan auf und arbeitet ihn erst danach ab, statt sofort loszulegen.",
      beispielLoesung:
        "Ich soll nächste Woche einen 10-Minuten-Vortrag über unser neues Ablagesystem halten. Erstelle zuerst einen Plan, wie du vorgehst. Führe den Plan danach Schritt für Schritt aus und schreibe den Vortrag.",
    },
    {
      id: "self-refine",
      nr: 9,
      titel: "Erst schreiben, dann verbessern",
      technik: "Self-Refine (Selbstkritik und Überarbeitung)",
      instruktion:
        "Schreibe einen Prompt, der in drei Runden arbeitet: erst eine Antwort, dann eine Kritik daran, dann eine verbesserte Fassung.",
      technikSatz:
        "Bei Self-Refine schreibt das Modell erst eine Antwort, kritisiert sie selbst und liefert danach eine überarbeitete Version.",
      beispielLoesung:
        "Schreibe eine Produktbeschreibung für eine wiederverwendbare Trinkflasche, etwa 80 Wörter. Prüfe deinen Text danach selbst auf Werbefloskeln, fehlende Fakten und Länge und schreibe die Kritik auf. Schreibe zum Schluss eine verbesserte Fassung.",
    },
    {
      id: "flipped-interaction",
      nr: 10,
      titel: "Lass dich ausfragen",
      technik: "Prompt Pattern: Flipped Interaction (umgedrehtes Gespräch)",
      instruktion:
        "Schreibe einen Prompt, in dem nicht du fragst, sondern das Modell dir Fragen stellt, bis es genug weiß — und sag ihm, was am Ende herauskommen soll.",
      technikSatz:
        "Bei der Flipped Interaction (umgedrehtes Gespräch) drehst du die Rollen um: das Modell stellt dir so lange Fragen, bis es genug Informationen für das gewünschte Ergebnis hat.",
      beispielLoesung:
        "Ich möchte am Ende einen fertigen Wochenplan für mein Mittagessen. Stelle mir vorher alle Fragen, die du dafür brauchst — immer nur eine Frage auf einmal. Wenn du genug weißt, sag Bescheid und erstelle den Plan.",
    },
  ],
};

import "server-only";

// Client for the Cortecs AI gateway (https://cortecs.ai) — OpenAI-compatible
// chat completions, EU-hosted providers only.
//
// Why a forced tool call instead of response_format/json_schema:
// the Cortecs model catalogue (GET /v1/models, public) advertises exactly three
// features — json_mode, reasoning and tools. No model declares json_schema, so
// a strict schema cannot be enforced that way. `tools` is supported by nearly
// every model, so we define one function whose parameter schema IS the verdict
// schema and force the model to call it. If the gateway ever ignores
// tool_choice we fall back to json_object plus text extraction; the caller
// validates the result either way.

const BASE_URL = "https://api.cortecs.ai/v1";
const TIMEOUT_MS = 30_000;
const TOOL_NAME = "bewertung_abgeben";

/** Which path produced the verdict — logged so the live smoke test can tell. */
export type ParseZweig = "tool_call" | "json_object" | "regex" | "fail";

export type CortecsErgebnis =
  | { ok: true; daten: unknown; zweig: ParseZweig }
  | { ok: false; zweig: "fail"; grund: string };

// Structure only — no grading criteria in here, so this is not sensitive.
const BEWERTUNG_SCHEMA = {
  type: "object",
  properties: {
    korrekt: {
      type: "boolean",
      description: "true nur, wenn alle Kriterien erfüllt sind",
    },
    kriterien: {
      type: "array",
      description:
        "Genau die im System-Prompt genannten Kriterien, in derselben Reihenfolge und mit exakt denselben Namen",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          erfuellt: { type: "boolean" },
        },
        required: ["name", "erfuellt"],
        additionalProperties: false,
      },
    },
    kommentar: {
      type: "string",
      description: "Höchstens zwei Sätze, einfache Sprache, direkte Anrede",
    },
    tipp: { type: "string", description: "Ein konkreter nächster Schritt" },
  },
  required: ["korrekt", "kriterien", "kommentar", "tipp"],
  additionalProperties: false,
} as const;

export function cortecsModell(): string {
  return process.env.CORTECS_MODEL || "claude-haiku-4-5";
}

export function hatCortecsKey(): boolean {
  return Boolean(process.env.CORTECS_API_KEY);
}

/** Parse a model's text answer: whole string first, then the first {...} block. */
function parseText(text: string): { daten: unknown; zweig: ParseZweig } | null {
  try {
    return { daten: JSON.parse(text), zweig: "json_object" };
  } catch {
    // Model wrapped the JSON in prose or a code fence.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return { daten: JSON.parse(text.slice(start, end + 1)), zweig: "regex" };
    } catch {
      return null;
    }
  }
}

type ChatAntwort = {
  choices?: {
    message?: {
      content?: string | null;
      tool_calls?: { function?: { name?: string; arguments?: string } }[];
    };
  }[];
};

async function post(body: unknown): Promise<ChatAntwort> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CORTECS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      // Truncated: some gateways echo the request back in the error body, and
      // that body ends up in the container logs.
      const detail = (await res.text()).slice(0, 300);
      throw new Error(`Cortecs HTTP ${res.status}: ${detail}`);
    }
    return (await res.json()) as ChatAntwort;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask the model for a verdict. Returns raw parsed JSON — shape validation is
 * the caller's job, because a model can return well-formed JSON of the wrong
 * shape.
 */
export async function holeBewertung(
  systemPrompt: string,
  userContent: string,
): Promise<CortecsErgebnis> {
  const basis = {
    model: cortecsModell(),
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  };

  // Attempt 1: forced tool call.
  try {
    const antwort = await post({
      ...basis,
      tools: [
        {
          type: "function",
          function: {
            name: TOOL_NAME,
            description:
              "Gibt die Bewertung der Nutzereingabe als strukturiertes Objekt zurück.",
            parameters: BEWERTUNG_SCHEMA,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: TOOL_NAME } },
    });

    const message = antwort.choices?.[0]?.message;
    const args = message?.tool_calls?.[0]?.function?.arguments;
    if (typeof args === "string" && args.trim()) {
      try {
        return { ok: true, daten: JSON.parse(args), zweig: "tool_call" };
      } catch {
        // Fall through — a broken tool payload is no better than no payload.
      }
    }
    // Gateway ignored tool_choice but answered in prose: still usable.
    if (typeof message?.content === "string" && message.content.trim()) {
      const parsed = parseText(message.content);
      if (parsed) return { ok: true, ...parsed };
    }
  } catch (err) {
    console.error("[quiz] Cortecs tool-call attempt failed:", err);
  }

  // Attempt 2: no tools, plain JSON mode. Costs a second call, and only runs
  // when the first one produced nothing usable.
  try {
    const antwort = await post({
      ...basis,
      response_format: { type: "json_object" },
    });
    const content = antwort.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim()) {
      const parsed = parseText(content);
      if (parsed) return { ok: true, ...parsed };
    }
    return { ok: false, zweig: "fail", grund: "Antwort ohne verwertbares JSON" };
  } catch (err) {
    console.error("[quiz] Cortecs json_object attempt failed:", err);
    return { ok: false, zweig: "fail", grund: "Cortecs nicht erreichbar" };
  }
}

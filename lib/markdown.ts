import { Marked, type Tokens } from "marked";

// Server-side Markdown → HTML for DB content (event bodies, legal pages).
// Content is only ever authored by signed-in admins, so no sanitizer is
// needed. `breaks: true` turns single newlines into <br> — friendlier for
// non-technical editors writing addresses or schedules.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `::video[<uuid>]::` alone on a line. */
const VIDEO_RE = /^::video\[([^\]\s]+)\]::[ \t]*(?:\n|$)/;
const VIDEO_RE_GLOBAL = /^::video\[([^\]\s]+)\]::[ \t]*$/gm;

type VideoToken = Tokens.Generic & { id: string };

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Which videos a text embeds. Callers use this to look up their accessible
 * names before rendering, so `renderMarkdown` itself can stay synchronous.
 */
export function collectVideoIds(md: string): string[] {
  const ids = new Set<string>();
  for (const match of md.matchAll(VIDEO_RE_GLOBAL)) {
    if (UUID_RE.test(match[1])) ids.add(match[1]);
  }
  return [...ids];
}

/**
 * Build a marked instance whose video extension knows the given labels.
 *
 * The extension deliberately performs no database lookup: the delivery URL
 * follows from the id alone (/api/media/<id>), which is what keeps rendering
 * synchronous. Anything beyond the URL — the accessible name — is passed in.
 * The id is checked against a strict UUID pattern before it reaches `src`.
 */
function build(labels?: ReadonlyMap<string, string>): Marked {
  const instance = new Marked();
  instance.use({
    extensions: [
      {
        name: "video",
        level: "block" as const,
        // Lets marked interrupt a paragraph at the shortcode.
        start(src: string) {
          const i = src.indexOf("::video[");
          return i === -1 ? undefined : i;
        },
        tokenizer(src: string): VideoToken | undefined {
          const match = VIDEO_RE.exec(src);
          if (!match || !UUID_RE.test(match[1])) return undefined;
          return { type: "video", raw: match[0], id: match[1] };
        },
        renderer(token: Tokens.Generic) {
          const { id } = token as VideoToken;
          const label = labels?.get(id);
          // <video> has no alt attribute; aria-label is what names it.
          const aria = label ? ` aria-label="${escapeAttr(label)}"` : "";
          return (
            `<video controls preload="metadata" playsinline${aria}>` +
            `<source src="/api/media/${id}" />` +
            `</video>`
          );
        },
      },
    ],
  });
  return instance;
}

// Texts without videos are the common case — no need to rebuild for those.
const plain = build();

export function renderMarkdown(
  md: string,
  labels?: ReadonlyMap<string, string>,
): string {
  const instance = labels?.size ? build(labels) : plain;
  return instance.parse(md, { async: false, gfm: true, breaks: true });
}

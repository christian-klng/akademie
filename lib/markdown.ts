import { marked, type Tokens } from "marked";

// Server-side Markdown → HTML for DB content (event bodies, legal pages).
// Content is only ever authored by signed-in admins, so no sanitizer is
// needed. `breaks: true` turns single newlines into <br> — friendlier for
// non-technical editors writing addresses or schedules.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type VideoToken = Tokens.Generic & { id: string };

/**
 * `::video[<id>]::` on its own line embeds an uploaded video. The admin video
 * list hands out the exact snippet.
 *
 * No database lookup on purpose: the delivery URL follows from the id alone
 * (/api/media/<id>), which keeps rendering synchronous. The id is matched
 * against a strict UUID pattern, so nothing arbitrary reaches the src.
 */
const videoExtension = {
  name: "video",
  level: "block" as const,
  // Lets marked interrupt a paragraph at the shortcode instead of swallowing it.
  start(src: string) {
    const i = src.indexOf("::video[");
    return i === -1 ? undefined : i;
  },
  tokenizer(src: string): VideoToken | undefined {
    const match = /^::video\[([^\]\s]+)\]::[ \t]*(?:\n|$)/.exec(src);
    if (!match || !UUID_RE.test(match[1])) return undefined;
    return { type: "video", raw: match[0], id: match[1] };
  },
  renderer(token: Tokens.Generic) {
    const { id } = token as VideoToken;
    return (
      `<video controls preload="metadata" playsinline>` +
      `<source src="/api/media/${id}" />` +
      `</video>`
    );
  },
};

marked.use({ extensions: [videoExtension] });

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false, gfm: true, breaks: true });
}

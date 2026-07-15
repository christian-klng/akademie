import { marked } from "marked";

// Server-side Markdown → HTML for DB content (event bodies, legal pages).
// Content is only ever authored by signed-in admins, so no sanitizer is
// needed. `breaks: true` turns single newlines into <br> — friendlier for
// non-technical editors writing addresses or schedules.
export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false, gfm: true, breaks: true });
}

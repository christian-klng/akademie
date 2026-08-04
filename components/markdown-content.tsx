import { collectVideoIds, renderMarkdown } from "@/lib/markdown";
import { getVideoLabels } from "@/lib/queries";

// Renders DB Markdown. Single place that resolves the accessible names of
// videos embedded via `::video[<id>]::` before handing the text to marked —
// so the alt text an admin writes reaches in-text videos too, not just the
// ones picked in the event form.
export async function MarkdownContent({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  const ids = collectVideoIds(markdown);
  const labels = ids.length > 0 ? await getVideoLabels(ids) : undefined;

  return (
    <div
      className={`md-content ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown, labels) }}
    />
  );
}

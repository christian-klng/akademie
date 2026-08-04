"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

// Copy a short snippet to the clipboard. Used for the video embed code in the
// admin — selecting it by hand out of a code block is fiddly.
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard access can be denied — then the text stays selectable.
        }
      }}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
      {copied ? "Kopiert" : label}
    </button>
  );
}

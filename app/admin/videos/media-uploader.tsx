"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

// File picker with a progress bar.
//
// XMLHttpRequest instead of fetch: only XHR reports upload progress, and a
// 200 MB video that uploads in silence for three minutes looks broken. The
// file goes up as the raw request body — the route handler streams it to disk
// (see ./upload/route.ts), which fetch/FormData would defeat by buffering.

type Props = {
  kind: "video" | "poster";
  label: string;
  /** Video id a poster belongs to — linked server-side in the same request. */
  attachTo?: string;
  className?: string;
};

export function MediaUploader({ kind, label, attachTo, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accept =
    kind === "video" ? "video/mp4,video/webm" : "image/jpeg,image/png,image/webp";

  function upload(file: File) {
    setError(null);
    setPercent(0);

    const query = new URLSearchParams({
      kind,
      type: file.type,
      name: file.name,
      // Strip the extension — "workshop-teil-1" reads better than the file name.
      title: file.name.replace(/\.[^.]+$/, ""),
      ...(attachTo ? { attachTo } : {}),
    });

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/admin/videos/upload?${query}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setPercent(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      setPercent(null);
      if (inputRef.current) inputRef.current.value = "";

      let payload: { id?: string; error?: string } = {};
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        // Non-JSON body means the request never reached the handler.
      }

      if (xhr.status >= 200 && xhr.status < 300 && payload.id) {
        router.refresh();
      } else {
        setError(payload.error ?? "Der Upload hat nicht geklappt.");
      }
    };

    xhr.onerror = () => {
      setPercent(null);
      setError("Die Verbindung ist abgebrochen. Versuch es noch einmal.");
    };

    xhr.send(file);
  }

  const busy = percent !== null;

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className={
          kind === "video"
            ? "inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            : "rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        }
      >
        {kind === "video" && <Upload className="h-4 w-4" aria-hidden />}
        {busy ? `${percent} %` : label}
      </button>

      {busy && (
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-neutral-900 transition-all dark:bg-white"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

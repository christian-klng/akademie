"use client";

import { useActionState } from "react";
import { savePage, type PageFormState } from "./actions";

const initialState: PageFormState = {};

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-white";

export function PageForm({
  slug,
  title,
  body,
}: {
  slug: string;
  title: string;
  body: string;
}) {
  const [state, formAction, pending] = useActionState(savePage, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />

      <div className="space-y-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          Titel
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={title}
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="body" className="text-sm font-medium">
          Inhalt
        </label>
        <textarea
          id="body"
          name="body"
          rows={24}
          defaultValue={body}
          className={`${inputClass} resize-y font-mono text-xs leading-relaxed`}
        />
        <p className="text-xs text-neutral-500">
          Markdown: <code>## Überschrift</code>, <code>- Aufzählung</code>,{" "}
          <code>**fett**</code>. Leere Zeile = neuer Absatz.
        </p>
      </div>

      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 border-t border-neutral-200 pt-5 dark:border-neutral-800">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {pending ? "Wird gespeichert …" : "Speichern"}
        </button>
      </div>
    </form>
  );
}

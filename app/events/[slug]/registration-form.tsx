"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerForEvent, type RegistrationState } from "./actions";

const initialState: RegistrationState = {};

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-white";
const labelClass = "text-sm font-medium";

export function RegistrationForm({
  slug,
  isFull,
  isPaid,
  holdMinutes,
}: {
  slug: string;
  /** All seats taken — the form still works, it just books a waiting-list spot. */
  isFull: boolean;
  /** Paid event: submitting leads to Stripe. */
  isPaid: boolean;
  /**
   * How long the seat is held during checkout. Passed in rather than imported:
   * lib/reservation.ts pulls in drizzle, which has no business in a client
   * bundle.
   */
  holdMinutes: number;
}) {
  const [state, formAction, pending] = useActionState(
    registerForEvent,
    initialState,
  );

  const submitLabel = isFull
    ? "Auf die Warteliste"
    : isPaid
      ? "Anmelden und bezahlen"
      : "Jetzt anmelden";

  return (
    <form action={formAction} className="mt-5 space-y-4">
      <input type="hidden" name="slug" value={slug} />

      {/* Honeypot: hidden from people, filled in by bots. */}
      <div className="hidden" aria-hidden>
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="name" className={labelClass}>
            Dein Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            maxLength={120}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="email" className={labelClass}>
            Deine E-Mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="message" className={labelClass}>
          Möchtest du uns etwas mitteilen? (optional)
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          maxLength={2000}
          className={`${inputClass} resize-y`}
        />
      </div>

      <label className="flex items-start gap-2.5 text-sm text-neutral-600 dark:text-neutral-400">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-0.5 h-4 w-4 shrink-0 accent-neutral-900 dark:accent-white"
        />
        <span>
          Ja, ihr dürft meine Angaben speichern, um meine Anmeldung zu bearbeiten.
          Mehr dazu in der{" "}
          <Link href="/datenschutz" className="underline">
            Datenschutzerklärung
          </Link>
          .
        </span>
      </label>

      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {pending ? "Einen Moment …" : submitLabel}
      </button>

      {isPaid && !isFull && (
        <p className="text-xs text-neutral-500">
          Nach dem Absenden geht es weiter zur Bezahlung über Stripe. Wir halten
          deinen Platz {holdMinutes} Minuten lang frei. Fest angemeldet bist du,
          sobald deine Zahlung durch ist — dann kommt auch die Bestätigung per
          E-Mail.
        </p>
      )}
    </form>
  );
}

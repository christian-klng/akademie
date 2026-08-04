"use client";

import { useActionState } from "react";
import { saveEvent, type EventFormState } from "./actions";

export type EventFormValues = {
  id: string;
  title: string;
  slug: string;
  teaser: string;
  body: string;
  location: string;
  format: string; // "online" | "vor_ort"
  onlineUrl: string;
  price: string;
  capacity: string; // empty = unlimited
  stripeCheckoutUrl: string;
  registrationOpen: boolean;
  videoId: string; // "" = kein Video
  startsAt: string; // datetime-local value
  endsAt: string;
  published: boolean;
};

/** Videos to offer in the picker — loaded by the page, not by this component. */
export type VideoOption = { id: string; title: string };

const initialState: EventFormState = {};

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-white";
const labelClass = "text-sm font-medium";
const hintClass = "text-xs text-neutral-500";

export function EventForm({
  initial,
  videos,
}: {
  initial: EventFormValues;
  videos: VideoOption[];
}) {
  const [state, formAction, pending] = useActionState(saveEvent, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={initial.id} />

      <div className="space-y-1.5">
        <label htmlFor="title" className={labelClass}>
          Titel
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={initial.title}
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="slug" className={labelClass}>
          Web-Adresse (Slug)
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          defaultValue={initial.slug}
          placeholder="wird aus dem Titel erzeugt, wenn leer"
          className={inputClass}
        />
        <p className={hintClass}>
          Die Seite ist dann unter /events/&lt;slug&gt; erreichbar. Nur
          Kleinbuchstaben, Zahlen und Bindestriche.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="startsAt" className={labelClass}>
            Beginn
          </label>
          <input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={initial.startsAt}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="endsAt" className={labelClass}>
            Ende (optional)
          </label>
          <input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            defaultValue={initial.endsAt}
            className={inputClass}
          />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className={labelClass}>Wie findet es statt?</legend>
        <div className="flex gap-5 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="format"
              value="vor_ort"
              defaultChecked={initial.format !== "online"}
              className="h-4 w-4 accent-neutral-900 dark:accent-white"
            />
            Vor Ort
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="format"
              value="online"
              defaultChecked={initial.format === "online"}
              className="h-4 w-4 accent-neutral-900 dark:accent-white"
            />
            Online
          </label>
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="location" className={labelClass}>
            Ort
          </label>
          <input
            id="location"
            name="location"
            type="text"
            defaultValue={initial.location}
            placeholder="z. B. Online (Zoom) oder Berlin"
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="price" className={labelClass}>
            Preis
          </label>
          <input
            id="price"
            name="price"
            type="text"
            defaultValue={initial.price}
            placeholder='z. B. "149 € pro Person" oder "kostenlos"'
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="onlineUrl" className={labelClass}>
          Zugangslink (nur bei Online)
        </label>
        <input
          id="onlineUrl"
          name="onlineUrl"
          type="url"
          defaultValue={initial.onlineUrl}
          placeholder="https://zoom.us/j/…"
          className={inputClass}
        />
        <p className={hintClass}>
          Steht nie auf der Website. Er geht nur per E-Mail an Menschen, die
          einen Platz haben.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="capacity" className={labelClass}>
            Plätze
          </label>
          <input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            step={1}
            defaultValue={initial.capacity}
            placeholder="leer = unbegrenzt"
            className={inputClass}
          />
          <p className={hintClass}>
            Sind alle Plätze weg, landen weitere Anmeldungen auf der Warteliste.
          </p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="stripeCheckoutUrl" className={labelClass}>
            Stripe-Zahlungslink
          </label>
          <input
            id="stripeCheckoutUrl"
            name="stripeCheckoutUrl"
            type="url"
            defaultValue={initial.stripeCheckoutUrl}
            placeholder="https://buy.stripe.com/…"
            className={inputClass}
          />
          <p className={hintClass}>
            Leer lassen = kostenloses Event. Mit Link wird nach der Anmeldung zu
            Stripe weitergeleitet.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="videoId" className={labelClass}>
          Video
        </label>
        <select
          id="videoId"
          name="videoId"
          defaultValue={initial.videoId}
          className={inputClass}
        >
          <option value="">Kein Video</option>
          {videos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title}
            </option>
          ))}
        </select>
        <p className={hintClass}>
          Erscheint auf der Event-Seite über der Beschreibung. Videos lädst du
          unter &bdquo;Videos&ldquo; hoch.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="teaser" className={labelClass}>
          Kurzbeschreibung
        </label>
        <textarea
          id="teaser"
          name="teaser"
          rows={2}
          defaultValue={initial.teaser}
          className={`${inputClass} resize-y`}
        />
        <p className={hintClass}>
          Ein bis zwei Sätze — erscheinen auf der Startseite und oben auf der
          Event-Seite.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="body" className={labelClass}>
          Beschreibung
        </label>
        <textarea
          id="body"
          name="body"
          rows={16}
          defaultValue={initial.body}
          className={`${inputClass} resize-y font-mono text-xs leading-relaxed`}
        />
        <p className={hintClass}>
          Markdown: <code>## Überschrift</code>, <code>- Aufzählung</code>,{" "}
          <code>**fett**</code>. Leere Zeile = neuer Absatz.
        </p>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            name="published"
            defaultChecked={initial.published}
            className="h-4 w-4 accent-neutral-900 dark:accent-white"
          />
          Öffentlich sichtbar
        </label>
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            name="registrationOpen"
            defaultChecked={initial.registrationOpen}
            className="h-4 w-4 accent-neutral-900 dark:accent-white"
          />
          Anmeldung möglich
        </label>
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

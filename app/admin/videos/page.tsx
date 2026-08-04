import { count } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { listVideos, totalMediaBytes } from "@/lib/queries";
import { formatBytes, maxTotalBytes } from "@/lib/media";
import { formatShortDate } from "@/lib/format";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { CopyButton } from "@/components/copy-button";
import { MediaUploader } from "./media-uploader";
import { clearHomeVideo, deleteVideo, setHomeVideo, updateVideo } from "./actions";

export const dynamic = "force-dynamic";

// Feedback from updateVideo, which redirects back here with ?hinweis=…
const HINWEISE: Record<string, string> = {
  gespeichert: "Gespeichert.",
  "titel-fehlt": "Bitte gib einen Titel ein.",
};

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-white";

const actionClass =
  "inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900";

export default async function AdminVideosPage({
  searchParams,
}: {
  searchParams: Promise<{ hinweis?: string }>;
}) {
  const [{ hinweis }, videos, used] = await Promise.all([
    searchParams,
    listVideos(),
    totalMediaBytes(),
  ]);

  // How many events use each video — shown before deleting.
  const usageRows = await db
    .select({ videoId: schema.event.videoId, n: count() })
    .from(schema.event)
    .groupBy(schema.event.videoId);
  const usage = new Map(
    usageRows.filter((r) => r.videoId).map((r) => [r.videoId as string, r.n]),
  );

  const limit = maxTotalBytes();
  const percent = Math.min(100, Math.round((used / limit) * 100));

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Videos</h1>
        <MediaUploader kind="video" label="Video hochladen" />
      </div>

      {hinweis && HINWEISE[hinweis] && (
        <p
          className={`mt-4 rounded-lg px-4 py-2.5 text-sm ${
            hinweis === "titel-fehlt"
              ? "bg-danger/10 text-danger"
              : "bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400"
          }`}
          role="status"
        >
          {HINWEISE[hinweis]}
        </p>
      )}

      <div className="mt-6 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">Speicher</span>
          <span className="text-neutral-500">
            {formatBytes(used)} von {formatBytes(limit)}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className={`h-full transition-all ${percent > 85 ? "bg-danger" : "bg-neutral-900 dark:bg-white"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Lade fertige MP4-Dateien hoch (H.264/AAC) — die Seite rechnet Videos
          nicht um. Warte, bis der Balken bei 100 % ist: unvollständige Uploads
          werden abgelehnt, damit kein Video entsteht, das sich nicht abspielen
          lässt. Die Dateien liegen auf dem Server und sind in keinem Backup:
          bewahre die Originale bei dir auf.
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        {videos.length === 0 ? (
          <p className="p-5 text-sm text-neutral-500">
            Noch keine Videos. Lade oben das erste hoch.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {videos.map((video) => {
              const usedBy = usage.get(video.id) ?? 0;
              return (
                <li key={video.id} id={video.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {video.title}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {formatBytes(video.sizeBytes)} ·{" "}
                        {formatShortDate(video.createdAt)}
                        {usedBy > 0 &&
                          ` · in ${usedBy} ${usedBy === 1 ? "Event" : "Events"}`}
                        {video.posterId ? " · mit Standbild" : ""}
                      </p>
                    </div>
                    {video.showOnHome && (
                      <span className="shrink-0 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">
                        Startseite
                      </span>
                    )}
                  </div>

                  <video
                    controls
                    preload="none"
                    playsInline
                    aria-label={video.altText || video.title}
                    poster={
                      video.posterId ? `/api/media/${video.posterId}` : undefined
                    }
                    src={`/api/media/${video.id}`}
                    className="mt-3 w-full max-w-sm rounded-lg bg-neutral-900"
                  />

                  {/* <details> keeps the list scannable and needs no JavaScript. */}
                  <details className="mt-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-medium">
                      Titel und Alt-Text bearbeiten
                    </summary>
                    <form
                      action={updateVideo.bind(null, video.id)}
                      className="space-y-3 border-t border-neutral-200 p-3 dark:border-neutral-800"
                    >
                      <div className="space-y-1.5">
                        <label
                          htmlFor={`title-${video.id}`}
                          className="text-xs font-medium"
                        >
                          Titel
                        </label>
                        <input
                          id={`title-${video.id}`}
                          name="title"
                          type="text"
                          required
                          maxLength={200}
                          defaultValue={video.title}
                          className={inputClass}
                        />
                        <p className="text-xs text-neutral-500">
                          Nur für dich — so heißt das Video in dieser Liste und
                          im Auswahlfeld beim Event.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <label
                          htmlFor={`alt-${video.id}`}
                          className="text-xs font-medium"
                        >
                          Alt-Text
                        </label>
                        <input
                          id={`alt-${video.id}`}
                          name="altText"
                          type="text"
                          maxLength={300}
                          defaultValue={video.altText}
                          className={inputClass}
                        />
                        <p className="text-xs text-neutral-500">
                          Beschreibt in einem Satz, was im Video zu sehen ist —
                          für Menschen, die einen Screenreader nutzen. Bleibt das
                          Feld leer, wird der Titel vorgelesen.
                        </p>
                      </div>
                      <button
                        type="submit"
                        className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                      >
                        Speichern
                      </button>
                    </form>
                  </details>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {video.showOnHome ? (
                      <form action={clearHomeVideo.bind(null, video.id)}>
                        <button type="submit" className={actionClass}>
                          Von der Startseite nehmen
                        </button>
                      </form>
                    ) : (
                      <form action={setHomeVideo.bind(null, video.id)}>
                        <button type="submit" className={actionClass}>
                          Auf die Startseite
                        </button>
                      </form>
                    )}

                    <MediaUploader
                      kind="poster"
                      label={video.posterId ? "Standbild tauschen" : "Standbild"}
                      attachTo={video.id}
                    />

                    <CopyButton
                      value={`::video[${video.id}]::`}
                      label="Einbettcode"
                      className={actionClass}
                    />

                    <form action={deleteVideo.bind(null, video.id)}>
                      <ConfirmSubmit
                        label="Löschen"
                        pendingLabel="Wird gelöscht …"
                        confirmText={
                          usedBy > 0
                            ? `"${video.title}" wirklich löschen? ${usedBy} ${usedBy === 1 ? "Event verliert" : "Events verlieren"} dadurch das Video.`
                            : `"${video.title}" wirklich löschen? Die Datei ist danach weg.`
                        }
                        className={`${actionClass} border-danger/40 text-danger hover:bg-danger/10`}
                      />
                    </form>
                  </div>

                  <p className="mt-2 text-xs text-neutral-500">
                    Im Text einbinden mit{" "}
                    <code className="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-900">
                      ::video[{video.id}]::
                    </code>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

# Kubikraum Akademie — project guide

Homepage + Mini-CMS der **Kubikraum Akademie** (Weiterbildung zu KI/Software
für Fachexperten und Nicht-Techniker). Eigenständiges Repo, deployt auf
**Coolify**: `web` als Application (Rolling Update), Postgres 18 als
Compose-Ressource daneben.
Design/Layout ist eine Kopie der Kubikraum-Digital-Landing (gleiche Farbtokens,
Geist-Fonts, `max-w-2xl`-Spalte, Dark-Mode per `.dark`-Klasse).

## Kommandos

- `npm run dev` — lokal (braucht `DATABASE_URL` + `SESSION_SECRET`; für
  Video-Arbeit zusätzlich `MEDIA_DIR` auf ein beschreibbares Verzeichnis, sonst
  landen Uploads unter dem Default `/data/media`).
- `npm run build` + `npm run lint` — nach jeder inhaltlichen Änderung, beide
  müssen sauber sein.
- `npm run db:push` — Drizzle-Schema anwenden; `npm run seed` — idempotenter
  Seed; `npm run migrate` — beides. Im Container läuft das nicht direkt,
  sondern über `scripts/start.sh` → `scripts/migrate-with-lock.mjs` (Lock +
  Zeitlimits), bevor der Server startet.

## Architektur & Invarianten

- **Next.js 16** (App Router): Middleware heißt `proxy.ts`; `cookies()`/
  `headers()`/`params` sind async. Vor Next-Code
  `node_modules/next/dist/docs/` konsultieren — Konventionen weichen vom
  Trainingsstand ab.
- **Sprache:** Öffentliche Texte sind Deutsch, bewusst **einfache Sprache**
  (du-Form, kurze Sätze, keine Fachbegriffe) — Zielgruppe sind
  Nicht-Techniker. Kein i18n-System.
- **DB (Drizzle + pg):** Schema in `lib/schema.ts` (fünf Tabellen:
  `admin_user`, `media`, `event`, `registration`, `static_page` — `media` steht
  vor `event`, weil `event.video_id` darauf zeigt). Pool öffnet **lazy** (`lib/db.ts`,
  Proxy auf `globalThis`) — der Docker-Build hat nur eine
  Platzhalter-`DATABASE_URL`. Deshalb tragen ALLE Seiten mit DB-Zugriff
  `export const dynamic = "force-dynamic"` (auch `sitemap.ts`). Nie
  `.unique()` auf Spalten — immer `uniqueIndex(...)` im Index-Array
  (`push --force` läuft ohne TTY und würde beim Truncate-Prompt hängen).
- **Auth:** kein Auth.js. HMAC-signierter Cookie (`lib/auth.ts`, Web Crypto,
  edge-safe — KEINE Node-Imports dort hinein). `proxy.ts` gated nur
  `/admin/:path*`. Credential-Check gegen die DB mit `bcryptjs` lebt in
  `app/login/actions.ts` (inkl. Dummy-Hash gegen Timing-Enumeration).
  Session-Secret: env `SESSION_SECRET`.
- **Inhalte = Markdown** in der DB, gerendert server-seitig via `marked`
  (`lib/markdown.ts`, `breaks: true`). Kein Sanitizer — Autoren sind
  ausschließlich eingeloggte Admins. Styling über `.md-content` in
  `app/globals.css` (Literalfarben — Tailwind v4 emittiert Theme-Variablen
  nur, wenn Utilities sie nutzen). Eine eigene marked-Erweiterung macht aus
  `::video[<uuid>]::` ein `<video>`; sie schlägt bewusst NICHT in der DB nach
  (die URL folgt allein aus der ID), damit das Rendern synchron bleibt — die
  ID wird gegen ein striktes UUID-Muster geprüft, bevor sie in `src` landet.
  Alles, was über die URL hinausgeht (der Alt-Text), wird vorher aufgelöst:
  `collectVideoIds()` → `getVideoLabels()` → `renderMarkdown(md, labels)`.
  Gerendert wird ausschließlich über `components/markdown-content.tsx`, damit
  dieser Schritt nicht an einer Aufrufstelle vergessen wird.
- **Event-Zeiten sind Wanduhr-Zeiten:** naive `timestamp`-Spalten. Drizzle
  liest/schreibt sie als UTC; Formular-Parsing (`parseDatetimeLocalValue`)
  und Anzeige (`lib/format.ts`) laufen in Server-Lokalzeit. Netto: Eingabe
  „09:00“ ⇒ Anzeige „09:00“, unabhängig von der Server-Zeitzone. Der Seed
  MUSS deshalb UTC-ISO-Strings inserten (plain `pg` würde Dates lokal
  serialisieren → Drift auf Nicht-UTC-Maschinen). Nicht auf `timestamptz`
  umstellen, ohne alle Seiten anzupassen.
- **Anmeldungen:** Öffentliches Formular auf `/events/<slug>` schreibt in
  `registration`. **Belegt ist ein Platz durch `status = "angemeldet"` ODER
  eine `"reserviert"`-Zeile, deren `reserved_until` noch in der Zukunft
  liegt** — `lib/reservation.ts` (`occupiesSeat()`) ist die einzige Stelle,
  die das ausformuliert; alle Zählstellen rufen sie auf, sonst driften sie
  auseinander. `warteliste`, `storniert` und abgelaufene Reservierungen zählen
  nicht. Die Sitzplatz-Prüfung läuft in einer Transaktion mit
  `SELECT … FOR UPDATE` auf der Event-Zeile — sie verhindert Überbuchung UND
  Doppelanmeldungen, deshalb gibt es bewusst keinen Unique-Index auf
  `(event_id, email)`. `stripe_checkout_url` ist die einzige Wahrheit über
  kostenlos/bezahlt; `price` bleibt reiner Anzeigetext.
- **Bezahlt heißt: erst zahlen, dann Platz.** Die Anmeldung entsteht als
  `"reserviert"` mit 30-Minuten-Frist (`CHECKOUT_HOLD_MS`; beim Nachrücken
  48 Stunden, weil die Person auf eine Mail reagiert), dann Redirect auf den
  Stripe Payment Link mit `client_reference_id=<registration.id>`. Erst der
  Webhook macht daraus `"angemeldet"` und schickt die Bestätigung
  (`app/api/stripe/webhook/route.ts`, HMAC-Prüfung in `lib/stripe.ts` über den
  **rohen** Body — `req.text()`, nie geparstes JSON). Er läuft in derselben
  Transaktionsform wie die Anmeldung (Event-Zeile gelockt), sonst könnte eine
  Zahlung nach Fristablauf überbuchen. **Es gibt keinen Cleanup-Job**: eine
  abgelaufene Reservierung fällt allein durch den Zeitvergleich aus der
  Zählung. Kommt sie zurück, wird ihre Zeile überschrieben statt eine zweite
  anzulegen. Drei Ausgänge im Webhook: Platz frei → `angemeldet`; kein Platz
  mehr → `warteliste` + Alarm-Mail an den Admin + Info an die Person; vorher
  vom Admin storniert → bleibt `storniert` + Alarm-Mail (eine Zahlung darf
  eine Stornierung nicht still zurücknehmen). Wer schon bezahlt hat und
  nachrückt, wird direkt `angemeldet` — nie erneut zur Kasse gebeten.
  Mails laufen über `lib/mail.ts` (nodemailer, lazy wie `lib/db.ts`); ohne
  `SMTP_HOST` werden sie nur geloggt, eine Anmeldung darf nie an einer Mail
  scheitern.
- **Videos liegen auf dem Volume `media-data`** (`MEDIA_DIR`, Default
  `/data/media`), eine Zeile pro Datei in `media`; die Zeilen-UUID **ist** der
  Dateiname — nichts aus einem Request landet je in einem Pfad. Upload ist eine
  Route unter `/admin/` (von `proxy.ts` mitgegated), **kein** Server-Action:
  die haben 1 MB Body-Limit und puffern im RAM. Der rohe Request-Body wird
  direkt auf die Platte gestreamt, jeder Fehlversuch räumt die Teildatei weg.
  Standbilder werden im selben Request hochgeladen UND verknüpft (`attachTo`) —
  zwei Schritte hinterlassen verwaiste Dateien, die keine Oberfläche mehr
  anzeigt. Ausgeliefert wird über `app/api/media/[id]` **mit Range-Support**
  (206/416); ohne den ist ein Video in Safari/iOS nicht spulbar. `lib/media.ts`
  ist die einzige Stelle, die die Platte anfasst, und prüft vor jedem Upload
  echten freien Plattenplatz (`statfs`) — Postgres teilt sich die Platte.
  Kein Transkodieren: hochgeladen wird fertiges MP4/WebM. `title` und
  `alt_text` sind unter `/admin/videos` editierbar; **`<video>` hat kein
  `alt`-Attribut** — der Alt-Text landet als `aria-label`, mit dem Titel als
  Rückfall.
- **Event-Thumbnails** (`event.image_id` → `media` mit `kind = "image"`):
  eigener Upload unter `/admin/events/<id>/image`, der Datei speichert UND
  verknüpft; Bilder haben mit `MEDIA_MAX_IMAGE_MB` ein viel kleineres Limit als
  Videos. Anders als Videos gehört ein Thumbnail **genau einem Event** —
  `deleteEvent` und `removeEventImage` löschen deshalb Zeile und Datei mit,
  sonst bliebe eine Datei liegen, die keine Oberfläche listet. Anzeige 16:9
  (`aspect-video` + `object-cover`) über `next/image`; ohne Bild fällt es
  ersatzlos weg. `alt=""` ist Absicht — der Titel steht direkt daneben.
  Das Bild geht zusätzlich in `openGraph.images`, die Twitter-Card und das
  JSON-LD, dort als **absolute** URL über `SITE_URL` (Crawler lösen keine
  relativen Pfade auf).
  **Nach dem Schreiben läuft `probeVideo`** (MP4-Box-Struktur: `ftyp` + `moov`,
  keine Box über EOF hinaus; WebM: EBML-Magic) — ohne diese Prüfung wird ein
  abgerissener Upload als Erfolg verbucht und ergibt ein Video, das eingebettet
  wird und beim Play nichts tut (genau so 2026-08-04 in Produktion passiert:
  10 MB von 51 MB, `moov` fehlte). Ein Abgleich mit `content-length` gibt es
  zusätzlich, er greift aber nur, wenn der Header bis zur App durchkommt —
  hinter Traefik kam er nicht an, deshalb ist die Strukturprüfung die tragende
  Sicherung.
- **Statische Seiten sind ein fixes Set** (impressum/datenschutz/agb):
  editierbar, aber nicht anleg-/löschbar. Seed (`scripts/seed.mjs`) ist
  idempotent; erster Admin entsteht nur, solange kein Admin existiert.
- **Formulare:** Server-Actions + `useActionState`; Felder immer über
  `readField` (`lib/form.ts`) lesen — defensiv gegen Reacts
  `_N_<name>`-Wire-Prefix.

## Deployment (Coolify + GitHub Actions)

- **Zwei Coolify-Ressourcen, nicht mehr eine.** `web` ist eine
  **Application** (Docker Image `ghcr.io/christian-klng/akademie-web:latest`),
  Postgres bleibt die **Compose-Ressource** aus `docker-compose.yml` — die
  enthält nur noch `db`. Grund: Coolify macht **Rolling Updates ausschließlich
  für Applications, nie für Compose-Stacks**. Die Datenbank ist bewusst
  liegengeblieben (gleiches `db-data`-Volume, kein Dump/Restore).
- **Die Migration läuft beim Containerstart**, nicht in einem eigenen
  Service: `scripts/start.sh` → `scripts/migrate-with-lock.mjs` → `server.js`.
  Das ist die tragende Eigenschaft des Setups: Der neue Container migriert und
  wird erst danach gesund; bis dahin bedient der **alte** weiter. Scheitert
  die Migration, wird der neue Container nie gesund, Coolify bricht ab und die
  Seite bleibt unberührt. Vorher nahm ein stiller Einmal-Container die ganze
  Seite mit (2026-08-04, ~15 Stunden offline).
- **Rolling Updates haben vier Bedingungen** — alle vier müssen erfüllt
  bleiben: funktionierender Healthcheck, Standard-Container-Namen, **kein**
  Port-Mapping auf den Host (in Coolify nur „Ports Exposes: 3000") und keine
  Compose-Ressource. Ein `ports:`-Eintrag reicht, um alles davon zu kippen.
- **Healthcheck ist `/api/health`** (`app/api/health/route.ts`) und geht
  bewusst **nicht** an die Datenbank — sonst nähme Traefik den Container bei
  einem kurzen DB-Hänger aus dem Routing und machte aus einer Störung einen
  Ausfall. Die `HEALTHCHECK`-Instruktion im Dockerfile läuft über Node:
  `node:24-slim` hat weder curl noch wget.
- `migrate-with-lock.mjs` hält einen **Postgres-Advisory-Lock** (Key
  `823641907`), weil beim Rolling Update kurz zwei Container laufen und zwei
  gleichzeitige `drizzle-kit push` ein Rennen wären. Alle Wartezeiten haben
  Limits (`DB_WAIT_TIMEOUT_S`, `LOCK_WAIT_TIMEOUT_S`, `MIGRATE_TIMEOUT_S`) —
  der Startvorgang darf nie stumm hängen.
- **Ein Image baut GitHub Actions** (`.github/workflows/build-images.yml`):
  Push auf `main` → `ghcr.io/christian-klng/akademie-web` → **der Workflow**
  triggert am Ende den Coolify-Deploy-Webhook. **Auto-Deploy-on-Push in
  Coolify muss AUS bleiben**: es feuert Sekunden nach dem Push, lange bevor
  das Image existiert — genau so entstand am 2026-08-04 ein Deploy gegen ein
  halb gepushtes Image-Paar. Das separate `migrate`-Image ist entfallen; das
  halbiert auch die Pushes ins GHCR, das damals ins Rate-Limit lief.
- **`pull_policy: always` bzw. „Force pull" bleibt Pflicht.** `:latest` ist
  ein wandernder Tag; ohne Force-Pull benutzt der Server das lokal vorhandene
  Image weiter und deployt still den alten Stand, während die Oberfläche den
  aktuellen Commit anzeigt. Der Workflow taggt zusätzlich mit der Commit-SHA —
  die eignet sich, wenn ein Deploy exakt festgenagelt werden soll.
- **Der Server baut nie selbst.** Das Setup entstand auf einer 4-GB-Box, wo
  `next build` in den Swap lief. Der aktuelle Server (178.104.69.162) ist
  größer, sein RAM ist aber nicht nachgemessen.
- **Jede Env-Var muss dort stehen, wo sie gebraucht wird**: bei der
  Application in ihren Environment Variables, bei `db` im
  `environment:`-Block der Compose-Datei. Nach Env-Änderung redeployen.
- **Postgres-18-Image:** Volume-Mount ist `/var/lib/postgresql` (NICHT
  `…/data`) — Daten liegen unter `/var/lib/postgresql/18/docker`.
- **Zwei Volumes, beide ohne Backup:** `db-data` (bei der Compose-Ressource)
  und `media-data` (als Persistent Storage in die Application gemountet).
  Letzteres hält Videos und Event-Bilder; wird es gelöscht, zeigen alle
  `media`-Zeilen ins Leere (die Auslieferung antwortet dann 404).
  `/data/media` wird schon im Dockerfile angelegt und `node:node` übereignet —
  Docker übernimmt beim **ersten** Anlegen eines Volumes Inhalt und Eigentümer
  des Mountpunkts, sonst gehörte es root und der Container läuft als `node`
  (Uploads: `EACCES`). Auf dem Server verifiziert (2026-08-04): Rechte
  stimmen, Platte 38 GB mit ~17 GB frei.
- **Das Dockerfile hat nur noch eine Stage, die ausgeliefert wird:** `runner`.
  Sie trägt neben der Standalone-Ausgabe auch das Migrations-Werkzeug
  (volle `node_modules`, `lib/`, `scripts/`, `drizzle.config.ts`) — deshalb
  ist sie groß (~1 GB). Das ist der bewusste Preis dafür, dass der Container
  sich selbst migrieren kann. `deps`/`builder` sind Zwischenstufen.

## Konventionen

- Stil des bestehenden Codes übernehmen (Tailwind-Utilities, deutsche
  UI-Texte, englische Code-Kommentare). Commit/Push nur auf Nachfrage.

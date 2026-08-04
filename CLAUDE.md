# Kubikraum Akademie — project guide

Homepage + Mini-CMS der **Kubikraum Akademie** (Weiterbildung zu KI/Software
für Fachexperten und Nicht-Techniker). Eigenständiges Repo, deployt auf
**Coolify** als Compose-Stack (`db` Postgres 18 + one-shot `migrate` + `web`).
Design/Layout ist eine Kopie der Kubikraum-Digital-Landing (gleiche Farbtokens,
Geist-Fonts, `max-w-2xl`-Spalte, Dark-Mode per `.dark`-Klasse).

## Kommandos

- `npm run dev` — lokal (braucht `DATABASE_URL` + `SESSION_SECRET`).
- `npm run build` + `npm run lint` — nach jeder inhaltlichen Änderung, beide
  müssen sauber sein.
- `npm run db:push` — Drizzle-Schema anwenden; `npm run seed` — idempotenter
  Seed; `npm run migrate` — beides (Kommando des `migrate`-Containers).

## Architektur & Invarianten

- **Next.js 16** (App Router): Middleware heißt `proxy.ts`; `cookies()`/
  `headers()`/`params` sind async. Vor Next-Code
  `node_modules/next/dist/docs/` konsultieren — Konventionen weichen vom
  Trainingsstand ab.
- **Sprache:** Öffentliche Texte sind Deutsch, bewusst **einfache Sprache**
  (du-Form, kurze Sätze, keine Fachbegriffe) — Zielgruppe sind
  Nicht-Techniker. Kein i18n-System.
- **DB (Drizzle + pg):** Schema in `lib/schema.ts` (vier Tabellen:
  `admin_user`, `event`, `registration`, `static_page`). Pool öffnet **lazy** (`lib/db.ts`,
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
  nur, wenn Utilities sie nutzen).
- **Event-Zeiten sind Wanduhr-Zeiten:** naive `timestamp`-Spalten. Drizzle
  liest/schreibt sie als UTC; Formular-Parsing (`parseDatetimeLocalValue`)
  und Anzeige (`lib/format.ts`) laufen in Server-Lokalzeit. Netto: Eingabe
  „09:00“ ⇒ Anzeige „09:00“, unabhängig von der Server-Zeitzone. Der Seed
  MUSS deshalb UTC-ISO-Strings inserten (plain `pg` würde Dates lokal
  serialisieren → Drift auf Nicht-UTC-Maschinen). Nicht auf `timestamptz`
  umstellen, ohne alle Seiten anzupassen.
- **Anmeldungen:** Öffentliches Formular auf `/events/<slug>` schreibt in
  `registration`. Ein Platz gilt als belegt, sobald `status = "angemeldet"`
  (unabhängig von der Zahlung); `warteliste`/`storniert` zählen nicht. Die
  Sitzplatz-Prüfung läuft in einer Transaktion mit `SELECT … FOR UPDATE` auf
  der Event-Zeile — sie verhindert Überbuchung UND Doppelanmeldungen, deshalb
  gibt es bewusst keinen Unique-Index auf `(event_id, email)`.
  `stripe_checkout_url` ist die einzige Wahrheit über kostenlos/bezahlt;
  `price` bleibt reiner Anzeigetext. Bezahlt = Redirect auf den Stripe Payment
  Link mit `client_reference_id=<registration.id>`, Bestätigung erst durch den
  Webhook (`app/api/stripe/webhook/route.ts`, HMAC-Prüfung in `lib/stripe.ts`
  über den **rohen** Body — `req.text()`, nie geparstes JSON). Mails laufen
  über `lib/mail.ts` (nodemailer, lazy wie `lib/db.ts`); ohne `SMTP_HOST`
  werden sie nur geloggt, eine Anmeldung darf nie an einer Mail scheitern.
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
  Kein Transkodieren: hochgeladen wird fertiges MP4/WebM.
- **Statische Seiten sind ein fixes Set** (impressum/datenschutz/agb):
  editierbar, aber nicht anleg-/löschbar. Seed (`scripts/seed.mjs`) ist
  idempotent; erster Admin entsteht nur, solange kein Admin existiert.
- **Formulare:** Server-Actions + `useActionState`; Felder immer über
  `readField` (`lib/form.ts`) lesen — defensiv gegen Reacts
  `_N_<name>`-Wire-Prefix.

## Deployment (Coolify + GitHub Actions)

- **Images baut GitHub Actions** (`.github/workflows/build-images.yml`): Push
  auf `main` → `ghcr.io/christian-klng/akademie-web` und `…-migrate` →
  Workflow triggert den Coolify-Deploy-Webhook. Coolify pullt nur
  (`image:` in `docker-compose.yml`), der Server baut nie selbst (4-GB-Box,
  `next build` würde sie in den Swap drücken). Auto-Deploy-on-Push in
  Coolify muss AUS bleiben, sonst deployt Coolify, bevor das Image fertig ist.
- **`web` und `migrate` tragen `pull_policy: always`.** Beide zeigen auf den
  wandernden Tag `:latest`. Ohne diese Zeile benutzt `compose up` das lokal
  schon vorhandene Image weiter und deployt still den alten Stand — während
  Coolify in der Oberfläche den aktuellen Commit anzeigt, weil von dort nur
  die `docker-compose.yml` stammt. Symptom: Deploy „erfolgreich", Seite alt.
  `db` bekommt das bewusst NICHT (Datenbank soll nicht ungefragt hochziehen).
  Der Workflow taggt zusätzlich mit der Commit-SHA — die eignet sich, wenn
  ein Deploy exakt festgenagelt werden soll.
- Eine Compose-Resource; Domain auf `web` (Port 3000), HTTPS.
- **Jede Env-Var muss im `environment:`-Block des Services referenziert
  sein**, sonst injiziert Coolify sie nicht. Nach Env-Änderung redeployen.
- **Postgres-18-Image:** Volume-Mount ist `/var/lib/postgresql` (NICHT
  `…/data`) — Daten liegen unter `/var/lib/postgresql/18/docker`.
- **Coolify ist das einzige Deploy-Ziel.** Das Dockerfile hat genau drei
  Stages, die zählen: `migrator` und `runner` werden vom Workflow explizit
  per `--target` gebaut, `deps`/`builder` sind Zwischenstufen. Es gibt keine
  Plattform, die „die letzte Stage" baut — neue Stages dürfen also frei
  hinten angehängt werden.

## Konventionen

- Stil des bestehenden Codes übernehmen (Tailwind-Utilities, deutsche
  UI-Texte, englische Code-Kommentare). Commit/Push nur auf Nachfrage.

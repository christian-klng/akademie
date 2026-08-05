# Kubikraum Akademie

Homepage der **Kubikraum Akademie** — Weiterbildungs-Angebote rund um KI und
Software für Fachexperten und Nicht-Techniker. Next.js 16 + Tailwind v4 +
Postgres 18 (Drizzle), Design/Layout übernommen von Kubikraum Digital.

## Was die App kann

- **Öffentlich:** Startseite mit Slogan + genau einem hervorgehobenen Event,
  Event-Detailseite (`/events/<slug>`), Impressum/Datenschutz/AGB aus der DB.
- **Admin (`/login` → `/admin`):** Events anlegen/bearbeiten/löschen
  (Entwurf/öffentlich), die drei statischen Seiten bearbeiten (Markdown).
- Inhalte sind **Beispieltexte** (Seed) — alles per Login editierbar.

## Lokal entwickeln

```bash
# 1. Lokale Postgres 18 starten (der compose-`db`-Service publiziert bewusst
#    keinen Host-Port; für die lokale Entwicklung eigene Instanz nutzen):
docker run --rm -d --name akademie-pg -p 5432:5432 \
  -e POSTGRES_USER=akademie -e POSTGRES_PASSWORD=akademie -e POSTGRES_DB=akademie \
  postgres:18

# 2. Schema + Seed einspielen
npm install
DATABASE_URL=postgresql://akademie:akademie@localhost:5432/akademie \
ADMIN_EMAIL=du@example.com ADMIN_PASSWORD=geheim \
npm run migrate

# 3. Dev-Server (Variablen alternativ in .env.local ablegen)
DATABASE_URL=postgresql://akademie:akademie@localhost:5432/akademie \
SESSION_SECRET=dev-secret \
npm run dev
```

Erster Admin-Login: wird vom Seed aus `ADMIN_EMAIL`/`ADMIN_PASSWORD` angelegt
(nur solange noch **kein** Admin existiert). Ohne diese Variablen läuft die
Seite, aber der Login bleibt leer — Seed mit gesetzten Variablen erneut
ausführen (`npm run seed`).

## Kommandos

- `npm run dev` / `npm run build` / `npm run lint`
- `npm run db:push` — Drizzle-Schema in die DB pushen
- `npm run seed` — idempotenter Seed (Admin, statische Seiten, Beispiel-Event)
- `npm run migrate` — `db:push --force` + Seed. Im Container läuft das über
  `scripts/start.sh` → `scripts/migrate-with-lock.mjs`, bevor der Server startet

## Deploy (GitHub Actions baut, Coolify pullt)

Der Server baut nichts selbst: Bei jedem Push auf `main` baut
`.github/workflows/build-images.yml` das Image
`ghcr.io/christian-klng/akademie-web`, pusht es in die GitHub Container
Registry und stößt (falls die Secrets `COOLIFY_WEBHOOK` + `COOLIFY_TOKEN`
gesetzt sind) den Coolify-Deploy an.

**Zwei Ressourcen in Coolify:**

- **Application** (Docker Image) — die Website. Coolify tauscht sie per
  *Rolling Update*: Der neue Container startet, wendet das Schema an und
  bedient erst danach; solange läuft der **alte** weiter. Geht beim Start
  etwas schief, wird der neue nie gesund, der Deploy bricht ab — und die Seite
  bleibt unberührt online.
- **Docker Compose** — nur noch Postgres (`docker-compose.yml`).

Einmalige Einrichtung:

1. **Compose-Ressource** aus diesem Repo anlegen (enthält nur `db`).
   **Auto-Deploy bei Push ausschalten** — deployt wird erst, wenn der
   Actions-Workflow das Image fertig gepusht hat.
2. Nach dem ersten Workflow-Lauf das GHCR-Paket `akademie-web` auf **public**
   stellen (GitHub → Packages → Package settings → Change visibility), sonst
   kann der Server es nicht pullen.
3. **Application** anlegen, Typ *Docker Image*,
   `ghcr.io/christian-klng/akademie-web:latest`. Dabei:
   - **Ports Exposes: 3000**, aber **kein** Port-Mapping auf den Host —
     ein Host-Port schaltet Rolling Updates ab.
   - **Healthcheck** auf `/api/health`.
   - **Persistent Storage**: das Volume `media-data` nach `/data/media`.
   - **Domain** setzen, HTTPS aktivieren.
4. **Env-Variablen** setzen (siehe `.env.example`): bei der Application
   `DATABASE_URL`, `SESSION_SECRET`, `SITE_URL`, `ADMIN_EMAIL`,
   `ADMIN_PASSWORD`, SMTP, Stripe, Medien-Limits; bei der Compose-Ressource
   `POSTGRES_PASSWORD`. Coolify injiziert eine UI-Variable in den
   Compose-Stack nur, wenn der Service sie im `environment:`-Block
   referenziert — dort ist alles Nötige verdrahtet.
5. Für automatisches Redeploy: in Coolify die **Deploy-Webhook-URL** der
   *Application* (Tab „Webhooks“) und ein **API-Token** (Keys & Tokens)
   erzeugen und als GitHub-Repo-Secrets `COOLIFY_WEBHOOK` / `COOLIFY_TOKEN`
   hinterlegen.
6. Nach jeder Env-Änderung **redeployen** (Node liest `process.env` nur beim
   Start).

### Hinweise

- **Postgres 18:** Das Volume ist auf `/var/lib/postgresql` gemountet (nicht
  mehr `…/data`) — die 18er-Images legen die Daten unter
  `/var/lib/postgresql/18/docker` ab. Nicht ändern, sonst schreiben die Daten
  am Volume vorbei.
- **Migrations:** `drizzle-kit push --force` läuft ohne TTY. Deshalb nie
  `.unique()` auf eine Spalte einer befüllten Tabelle legen — stattdessen
  `uniqueIndex(...)` im Index-Array (so wie in `lib/schema.ts`).
- Der Docker-Build nutzt Platzhalter-`DATABASE_URL`/`SESSION_SECRET`; echte
  Werte kommen zur Laufzeit. Alle DB-Seiten sind `force-dynamic`, der Pool
  öffnet lazy (`lib/db.ts`) — so schlägt der Build nie gegen die DB.

## Inhalte pflegen

- Events + Seiten: einloggen unter `/login`, dann `/admin`.
- Texte sind **Markdown** (`## Überschrift`, `- Liste`, `**fett**`); einzelne
  Zeilenumbrüche werden zu `<br>`.
- Offene Stellen in den Rechtstexten sind mit **[Bitte ergänzen]** markiert.
- Event-Zeiten sind „Wanduhr“-Zeiten (keine Zeitzonen-Umrechnung): was du im
  Formular einträgst, wird genau so angezeigt.

### Videos

Unter `/admin/videos` lädst du Videos hoch. Sie landen auf dem Volume
`media-data` und lassen sich an drei Stellen einbinden: als Video eines Events
(Auswahlfeld im Event-Formular), als Video der Startseite (Knopf „Auf die
Startseite“) und mitten im Text über `::video[<id>]::` — den fertigen Schnipsel
kopierst du dir in der Video-Liste.

- **Format:** fertige MP4-Dateien (H.264/AAC) oder WebM. Die Seite rechnet
  nichts um — was du hochlädst, wird ausgeliefert.
- **Grenzen:** `MEDIA_MAX_FILE_MB` pro Datei, `MEDIA_MAX_TOTAL_MB` insgesamt.
  Beides bremst absichtlich: die Videos liegen auf derselben Platte wie
  Postgres, und eine volle Platte stoppt die Datenbank.
- **Kein Backup.** Das Volume wird nirgends gesichert. Bewahre die
  Originaldateien bei dir auf.
- **Traffic läuft über den Server.** Für gelegentliche Erklärvideos passt das.
  Werden Videos zum Hauptinhalt, ist ein EU-Videodienst (z. B. Bunny Stream)
  der nächste Schritt — es müsste nur die Auslieferung getauscht werden.

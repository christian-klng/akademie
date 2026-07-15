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
- `npm run migrate` — `db:push --force` + Seed (läuft im `migrate`-Container)

## Deploy auf Coolify

1. Repo als **Docker-Compose-Resource** anlegen (dieses Verzeichnis enthält
   `docker-compose.yml`: `db` + einmaliges `migrate` + `web`).
2. **Domain** auf den `web`-Service legen (Port 3000), HTTPS aktivieren.
3. **Env-Variablen** in der Coolify-UI setzen (siehe `.env.example`):
   `POSTGRES_PASSWORD`, `SESSION_SECRET`, `SITE_URL`, `ADMIN_EMAIL`,
   `ADMIN_PASSWORD`. Wichtig: Coolify injiziert eine UI-Variable nur, wenn der
   Service sie im `environment:`-Block referenziert — alle nötigen Variablen
   sind dort bereits verdrahtet.
4. Nach jeder Env-Änderung **redeployen/neustarten** (Node liest `process.env`
   nur beim Start).

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

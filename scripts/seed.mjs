// Idempotent seed, run by the one-shot `migrate` compose service right after
// `drizzle-kit push`. Safe to run any number of times:
//   1. First admin from ADMIN_EMAIL/ADMIN_PASSWORD — only if no admin exists.
//   2. The three static pages (draft texts) — only for slugs that don't exist.
//   3. One published sample event — only if the event table is empty.
// Plain `pg` + `bcryptjs`, no drizzle needed here.

import { Pool } from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("seed: DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function seedAdmin() {
  const { rows } = await pool.query(
    'SELECT count(*)::int AS n FROM "admin_user"',
  );
  if (rows[0].n > 0) {
    console.log("seed: admin user exists — skipping");
    return;
  }
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || !password) {
    console.warn(
      "seed: no admin yet and ADMIN_EMAIL/ADMIN_PASSWORD not set — login will not work until seeded",
    );
    return;
  }
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    'INSERT INTO "admin_user" (email, password_hash) VALUES ($1, $2)',
    [email, hash],
  );
  console.log(`seed: created admin ${email}`);
}

// Draft legal texts in Markdown. Open fields are marked **[Bitte ergänzen]**
// so nothing half-filled goes live unnoticed. Editable later at /admin/pages.
const STATIC_PAGES = [
  {
    slug: "impressum",
    title: "Impressum",
    body: `## Angaben gemäß § 5 DDG

Christian Klang
Köpenicker Landstr. 262
12437 Berlin
Deutschland

## Kontakt

E-Mail: christian@kubikraum.digital
Telefon: **[Bitte ergänzen]**

## Umsatzsteuer-ID

Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: DE299488482

## Redaktionell verantwortlich (§ 18 Abs. 2 MStV)

Christian Klang, Anschrift wie oben

## EU-Streitschlichtung

Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: [https://ec.europa.eu/consumers/odr/](https://ec.europa.eu/consumers/odr/). Unsere E-Mail-Adresse findest du oben.

## Verbraucherstreitbeilegung / Universalschlichtungsstelle

Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.

## Haftung für Inhalte

Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.

## Haftung für Links

Unser Angebot enthält ggf. Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Für diese fremden Inhalte können wir keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich.

## Urheberrecht

Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht.`,
  },
  {
    slug: "datenschutz",
    title: "Datenschutzerklärung",
    body: `**Hinweis: Dies ist ein Entwurf (Beispieltext) und keine Rechtsberatung. Bitte vor Veröffentlichung prüfen und ergänzen.**

## 1. Verantwortlicher

Christian Klang
Köpenicker Landstr. 262
12437 Berlin
E-Mail: christian@kubikraum.digital

## 2. Welche Daten wir verarbeiten

Beim Besuch dieser Website verarbeitet der Server automatisch technische Daten (z. B. IP-Adresse, Datum und Uhrzeit des Zugriffs, aufgerufene Seite). Diese Daten sind nötig, um die Website anzuzeigen und sicher zu betreiben.

**[Bitte ergänzen: Hosting-Anbieter und Auftragsverarbeitung]**

## 3. Anmeldung zu Veranstaltungen

Wenn du dich per E-Mail zu einer Veranstaltung anmeldest, verarbeiten wir die Angaben aus deiner E-Mail (Name, E-Mail-Adresse, Nachricht), um deine Anmeldung zu bearbeiten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragsanbahnung).

## 4. Cookies

Diese Website verwendet keine Tracking-Cookies. Es wird lediglich eine technisch notwendige Einstellung (z. B. dein gewähltes Farbschema) lokal in deinem Browser gespeichert.

## 5. Deine Rechte

Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Wende dich dazu einfach per E-Mail an uns. Außerdem hast du das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.

## 6. Speicherdauer

Wir speichern personenbezogene Daten nur so lange, wie es für die genannten Zwecke nötig ist oder gesetzliche Aufbewahrungspflichten bestehen.

**[Bitte ergänzen: weitere Abschnitte je nach eingesetzten Diensten]**`,
  },
  {
    slug: "agb",
    title: "Allgemeine Geschäftsbedingungen",
    body: `**Hinweis: Dies ist ein Entwurf (Beispieltext) und keine Rechtsberatung. Bitte vor Veröffentlichung prüfen und ergänzen.**

## § 1 Geltungsbereich

Diese Allgemeinen Geschäftsbedingungen gelten für alle Weiterbildungs-Angebote der Kubikraum Akademie (Christian Klang, Köpenicker Landstr. 262, 12437 Berlin).

## § 2 Anmeldung und Vertragsschluss

Die Anmeldung zu einer Veranstaltung erfolgt per E-Mail. Der Vertrag kommt zustande, wenn wir deine Anmeldung per E-Mail bestätigen.

## § 3 Preise und Bezahlung

Es gelten die Preise, die bei der jeweiligen Veranstaltung angegeben sind. **[Bitte ergänzen: Zahlungsweise und Zahlungsziel]**

## § 4 Rücktritt und Stornierung

**[Bitte ergänzen: Stornierungsfristen und -bedingungen]**

## § 5 Absage durch den Veranstalter

Wir können eine Veranstaltung absagen, wenn zu wenige Anmeldungen vorliegen oder ein wichtiger Grund besteht. Bereits gezahlte Teilnahmegebühren werden in diesem Fall vollständig erstattet.

## § 6 Widerrufsrecht

Verbraucher haben ein gesetzliches Widerrufsrecht von 14 Tagen. **[Bitte ergänzen: Widerrufsbelehrung]**

## § 7 Haftung

Wir haften unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie bei Verletzung von Leben, Körper und Gesundheit. Im Übrigen ist die Haftung auf die Verletzung wesentlicher Vertragspflichten beschränkt.

## § 8 Schlussbestimmungen

Es gilt deutsches Recht. Sollten einzelne Bestimmungen unwirksam sein, bleibt der Vertrag im Übrigen wirksam.`,
  },
];

async function seedStaticPages() {
  for (const page of STATIC_PAGES) {
    const { rowCount } = await pool.query(
      'INSERT INTO "static_page" (slug, title, body) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING',
      [page.slug, page.title, page.body],
    );
    if (rowCount > 0) console.log(`seed: created static page ${page.slug}`);
  }
}

const SAMPLE_EVENT = {
  slug: "ki-im-arbeitsalltag-einsteiger-workshop",
  title: "KI im Arbeitsalltag — Einsteiger-Workshop",
  teaser:
    "Ein halber Tag, der sich lohnt: Du lernst, wie du KI-Werkzeuge sicher für deine tägliche Arbeit nutzt — ganz ohne Vorkenntnisse.",
  location: "Online (Zoom) — Beispieltext",
  price: "Beispiel: 149 € pro Person",
  body: `**Hinweis: Dies ist ein Beispiel-Event mit Beispieltexten.**

## Worum geht es?

Künstliche Intelligenz kann dir viel Arbeit abnehmen — wenn du weißt, wie du sie richtig einsetzt. In diesem Workshop zeigen wir dir Schritt für Schritt, wie du KI-Werkzeuge im Arbeitsalltag nutzt. Ohne Fachbegriffe, ohne Vorkenntnisse.

## Was du lernst

- Wie du einer KI gute Anweisungen gibst — und bessere Ergebnisse bekommst
- Wie du Texte, Tabellen und Präsentationen schneller erstellst
- Wie du eine kleine eigene Software-Anwendung baust — ohne eine Zeile Code
- Worauf du beim Datenschutz achten musst

## Für wen ist das?

Für alle, die viel Fachwissen haben, aber keine Technik-Profis sind: aus Verwaltung, Beratung, Handwerk, Gesundheitswesen oder anderen Bereichen. Du brauchst nur einen Laptop und einen Browser.

## Ablauf

- 09:00 Uhr — Begrüßung und Einstieg: Was kann KI, was kann sie nicht?
- 10:00 Uhr — Übung: Deine ersten guten Anweisungen an die KI
- 11:00 Uhr — Pause
- 11:15 Uhr — Übung: Deine erste eigene Anwendung, ohne Programmieren
- 12:30 Uhr — Fragen, Austausch und nächste Schritte

## Anmeldung

Schreib uns einfach eine E-Mail. Wir melden uns innerhalb von zwei Werktagen bei dir.`,
};

async function seedSampleEvent() {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM "event"');
  if (rows[0].n > 0) {
    console.log("seed: events exist — skipping sample event");
    return;
  }
  // ~5 weeks out, 09:00 wall clock — always in the future on first deploy.
  const starts = new Date();
  starts.setDate(starts.getDate() + 35);
  starts.setHours(9, 0, 0, 0);
  const ends = new Date(starts);
  ends.setHours(13, 0, 0, 0);
  // Pass UTC ISO strings, not Date objects: drizzle reads naive timestamps as
  // UTC, while node-pg would serialize a Date in SERVER-LOCAL time (Postgres
  // drops the offset suffix on `timestamp` columns). UTC strings match the
  // app's convention on any machine.
  await pool.query(
    `INSERT INTO "event" (slug, title, teaser, body, location, starts_at, ends_at, price, published)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
    [
      SAMPLE_EVENT.slug,
      SAMPLE_EVENT.title,
      SAMPLE_EVENT.teaser,
      SAMPLE_EVENT.body,
      SAMPLE_EVENT.location,
      starts.toISOString(),
      ends.toISOString(),
      SAMPLE_EVENT.price,
    ],
  );
  console.log(`seed: created sample event ${SAMPLE_EVENT.slug}`);
}

try {
  await seedAdmin();
  await seedStaticPages();
  await seedSampleEvent();
  console.log("seed: done");
} finally {
  await pool.end();
}

// Applies the schema and runs the seed — as the FIRST thing a web container
// does, before it serves anything (scripts/start.sh).
//
// Why here and not in a separate one-shot container: with Coolify's rolling
// update the old container keeps serving until the new one reports healthy.
// Migrating inside the new container means a slow or failing migration simply
// aborts the deployment — the running site is never touched. A separate
// `migrate` service took the whole site offline on 2026-08-04 for ~15 hours.
//
// Three guarantees this script owns:
//   1. It waits briefly for the database instead of dying on a start-up race.
//   2. Only one container migrates at a time (Postgres advisory lock) — during
//      a rolling update two containers overlap, and two concurrent
//      `drizzle-kit push` runs would race.
//   3. It never hangs. A migration that overruns its budget is killed and the
//      container exits loudly, which is what the deployment needs to see.

import { spawn } from "node:child_process";
import { Pool } from "pg";

/** Arbitrary but stable — every container of this app must use the same key. */
const LOCK_KEY = 823641907;

const DB_WAIT_TIMEOUT_S = Number(process.env.DB_WAIT_TIMEOUT_S ?? 30);
const LOCK_WAIT_TIMEOUT_S = Number(process.env.LOCK_WAIT_TIMEOUT_S ?? 600);
const MIGRATE_TIMEOUT_S = Number(process.env.MIGRATE_TIMEOUT_S ?? 300);

function log(message) {
  console.log(`[start] ${message}`);
}

function fail(message) {
  console.error(`[start] FEHLER: ${message}`);
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Run a command, killing it if it outruns `timeoutS`. Resolves with the code. */
function run(command, args, timeoutS) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "inherit" });
    const timer = setTimeout(() => {
      console.error(
        `[start] FEHLER: "${command} ${args.join(" ")}" läuft seit ${timeoutS}s — abgebrochen.`,
      );
      child.kill("SIGKILL");
    }, timeoutS * 1000);

    child.on("error", (err) => {
      clearTimeout(timer);
      console.error(`[start] FEHLER: ${command} nicht startbar:`, err.message);
      resolve(1);
    });
    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      resolve(signal ? 1 : (code ?? 1));
    });
  });
}

if (!process.env.DATABASE_URL) fail("DATABASE_URL ist nicht gesetzt.");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Don't let a black-holed host stall the whole start-up.
  connectionTimeoutMillis: 5000,
});

// --- 1. Wait for the database ---------------------------------------------
let client;
const dbDeadline = Date.now() + DB_WAIT_TIMEOUT_S * 1000;
for (let attempt = 1; ; attempt++) {
  try {
    client = await pool.connect();
    break;
  } catch (err) {
    if (Date.now() >= dbDeadline) {
      fail(
        `Datenbank nach ${DB_WAIT_TIMEOUT_S}s nicht erreichbar (${err.message}). ` +
          `Prüfe DATABASE_URL und ob der Postgres-Container läuft.`,
      );
    }
    if (attempt === 1) log("Warte auf die Datenbank …");
    await sleep(2000);
  }
}
log("Datenbank erreichbar.");

// --- 2. Take the migration lock -------------------------------------------
// try_advisory_lock in a loop rather than the blocking variant: this way the
// wait has an explicit end and a readable message instead of hanging forever.
const lockDeadline = Date.now() + LOCK_WAIT_TIMEOUT_S * 1000;
let locked = false;
for (let attempt = 1; ; attempt++) {
  const { rows } = await client.query("SELECT pg_try_advisory_lock($1) AS ok", [
    LOCK_KEY,
  ]);
  if (rows[0].ok) {
    locked = true;
    break;
  }
  if (Date.now() >= lockDeadline) {
    fail(
      `Ein anderer Container migriert seit über ${LOCK_WAIT_TIMEOUT_S}s. Abgebrochen.`,
    );
  }
  if (attempt === 1) log("Ein anderer Container migriert gerade — warte …");
  await sleep(2000);
}

// --- 3. Migrate and seed ---------------------------------------------------
let exitCode = 0;
try {
  log("Schema anwenden …");
  exitCode = await run(
    "node_modules/.bin/drizzle-kit",
    ["push", "--force"],
    MIGRATE_TIMEOUT_S,
  );
  if (exitCode === 0) {
    exitCode = await run("node", ["scripts/seed.mjs"], MIGRATE_TIMEOUT_S);
  }
} finally {
  // Closing the session would release it anyway; explicit is clearer, and the
  // unlock must happen before another container can make progress.
  if (locked) {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
  }
  client.release();
  await pool.end().catch(() => {});
}

if (exitCode !== 0) {
  fail(
    "Migration fehlgeschlagen — der Container startet nicht. " +
      "Der bisher laufende Container bedient weiter.",
  );
}

log("Migration fertig.");

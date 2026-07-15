import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// A single shared pool. Connection is created LAZILY (on first query) rather
// than at import: Next evaluates modules that import this one during the
// build's page-data collection — where only the Dockerfile's placeholder
// DATABASE_URL exists. An eager `new Pool` / throw there breaks the build.

type Drizzle = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  akademiePool?: Pool;
  akademieDb?: Drizzle;
};

function getDb(): Drizzle {
  if (globalForDb.akademieDb) return globalForDb.akademieDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = globalForDb.akademiePool ?? new Pool({ connectionString });
  globalForDb.akademiePool = pool;

  const instance = drizzle(pool, { schema });
  globalForDb.akademieDb = instance;
  return instance;
}

// A thin proxy so call sites keep using `db.select(...)` / `db.insert(...)` /
// `db.query` unchanged, while the real connection is deferred until first access.
export const db = new Proxy({} as Drizzle, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
}) as Drizzle;

export { schema };

import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Schema is applied via `drizzle-kit push --force` in the one-shot `migrate`
// compose service (no TTY). Uniqueness therefore always lives in the table's
// index array as `uniqueIndex(...)` — a column-level `.unique()` on a populated
// table makes push prompt ("truncate?") and hang without a TTY.

/** Admins who may edit events and static pages (login on /login). */
export const adminUser = pgTable(
  "admin_user",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("admin_user_email_idx").on(t.email)],
);

/**
 * A single training event. Times are naive `timestamp` columns; drizzle reads
 * and writes them as UTC wall clock, while the form input is parsed and the
 * display is formatted in SERVER-LOCAL time (lib/format.ts). Net effect: the
 * wall-clock time an admin enters is exactly what visitors see, on any server
 * timezone (the deployed container runs UTC). The seed matches this by
 * inserting UTC ISO strings.
 */
export const event = pgTable(
  "event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    teaser: text("teaser").notNull().default(""),
    body: text("body").notNull().default(""), // Markdown
    location: text("location").notNull().default(""),
    startsAt: timestamp("starts_at", { mode: "date" }).notNull(),
    endsAt: timestamp("ends_at", { mode: "date" }),
    price: text("price").notNull().default(""), // free text: "kostenlos", "49 €"
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("event_slug_idx").on(t.slug)],
);

/** Editable static pages: impressum, datenschutz, agb (seeded by scripts/seed.mjs). */
export const staticPage = pgTable("static_page", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""), // Markdown
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export type Event = typeof event.$inferSelect;
export type StaticPage = typeof staticPage.$inferSelect;

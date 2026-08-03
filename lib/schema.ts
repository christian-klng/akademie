import {
  boolean,
  index,
  integer,
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
    /** "online" | "vor_ort" — see EVENT_FORMATS. */
    format: text("format").notNull().default("vor_ort"),
    /** Zoom/Meet link. Goes into the confirmation mail only, never on a page. */
    onlineUrl: text("online_url").notNull().default(""),
    startsAt: timestamp("starts_at", { mode: "date" }).notNull(),
    endsAt: timestamp("ends_at", { mode: "date" }),
    price: text("price").notNull().default(""), // free text: "kostenlos", "49 €"
    /** Number of seats; null = unlimited. */
    capacity: integer("capacity"),
    /**
     * Stripe payment link. Empty means the event is free — this single field
     * decides free vs. paid, `price` stays a pure display label.
     */
    stripeCheckoutUrl: text("stripe_checkout_url").notNull().default(""),
    /** Lets an admin close sign-ups without unpublishing the event. */
    registrationOpen: boolean("registration_open").notNull().default(true),
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("event_slug_idx").on(t.slug)],
);

export const EVENT_FORMATS = ["vor_ort", "online"] as const;
export type EventFormat = (typeof EVENT_FORMATS)[number];

/** Only "angemeldet" occupies a seat — waitlisted and cancelled rows do not. */
export const REGISTRATION_STATUSES = [
  "angemeldet",
  "warteliste",
  "storniert",
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

/** "kostenlos" for free events, otherwise "offen" until Stripe confirms. */
export const PAYMENT_STATUSES = ["kostenlos", "offen", "bezahlt"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * One person signed up for one event. Deliberately no unique index on
 * (event_id, email): a cancelled registration must not block signing up again.
 * Duplicates are prevented in the sign-up transaction, which locks the event
 * row anyway to count seats (app/events/[slug]/actions.ts).
 */
export const registration = pgTable(
  "registration",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    message: text("message").notNull().default(""),
    status: text("status").notNull().default("angemeldet"),
    paymentStatus: text("payment_status").notNull().default("kostenlos"),
    /** Stripe checkout session id — kept so a redelivered webhook is a no-op. */
    stripeSessionId: text("stripe_session_id").notNull().default(""),
    paidAt: timestamp("paid_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("registration_event_idx").on(t.eventId),
    index("registration_email_idx").on(t.email),
  ],
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
export type Registration = typeof registration.$inferSelect;

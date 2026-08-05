import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// Schema is applied via `drizzle-kit push --force` when a web container starts
// (scripts/start.sh), with no TTY. Uniqueness therefore always lives in the table's
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
 * An uploaded file on the media volume. The row id doubles as the file name
 * (lib/media.ts) — nothing from a request ever ends up in a path.
 *
 * Declared before `event` because `event.videoId` points at it.
 */
export const media = pgTable("media", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Editable display name; prefilled from the file name on upload. */
  title: text("title").notNull(),
  /**
   * Short description for screen readers. `<video>` has no `alt` attribute —
   * this becomes `aria-label`, which is what actually names a video element.
   */
  altText: text("alt_text").notNull().default(""),
  /** Original upload name — shown in the admin, used for the download link. */
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  // bigint, not integer: an integer column would overflow at ~2 GB, and the
  // per-file cap is configurable.
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  /** "video" | "poster" | "image" — see MEDIA_KINDS. */
  kind: text("kind").notNull().default("video"),
  /** Still image for a video. Self-reference, hence the AnyPgColumn callback. */
  posterId: uuid("poster_id").references((): AnyPgColumn => media.id, {
    onDelete: "set null",
  }),
  /** At most one video carries this; the admin action clears the others. */
  showOnHome: boolean("show_on_home").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// "poster" is the still frame of a video, "image" the thumbnail of an event.
export const MEDIA_KINDS = ["video", "poster", "image"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

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
    /** Optional video shown above the description. Deleting it just unlinks. */
    videoId: uuid("video_id").references(() => media.id, {
      onDelete: "set null",
    }),
    /**
     * Thumbnail: shown on the event card, on the event page and as the preview
     * image when the link is shared. Belongs to exactly this event — deleting
     * the event deletes it (see deleteEvent), unlike the shared videos.
     */
    imageId: uuid("image_id").references(() => media.id, {
      onDelete: "set null",
    }),
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("event_slug_idx").on(t.slug)],
);

export const EVENT_FORMATS = ["vor_ort", "online"] as const;
export type EventFormat = (typeof EVENT_FORMATS)[number];

/**
 * A seat is taken by "angemeldet" and by a "reserviert" row whose
 * `reservedUntil` is still in the future — see lib/reservation.ts, which is the
 * only place that spells this out. "warteliste", "storniert" and an expired
 * reservation take nothing.
 */
export const REGISTRATION_STATUSES = [
  "angemeldet",
  /** Seat held while the visitor is in Stripe checkout; expires on its own. */
  "reserviert",
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
    /**
     * When a "reserviert" row stops holding its seat. Null on every other
     * status. Written and compared as a JS `Date`, like the other timestamps
     * here — never against Postgres `now()`, which is DB-local while drizzle
     * reads and writes these naive columns as UTC.
     */
    reservedUntil: timestamp("reserved_until", { mode: "date" }),
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
export type Media = typeof media.$inferSelect;

/**
 * Application tables introduced by spec 01 (design "Data Models";
 * requirements F1-R8.1, F1-R11.2).
 *
 * - `user_settings`: one row per user, created by
 *   `databaseHooks.user.create.after`; profile timezone, study target and the
 *   flags later specs read and extend. `ON DELETE CASCADE` on `user_id` lets
 *   Better Auth's hard delete remove it in the same transaction (F1-R11.2).
 * - `auth_attempts`: fixed-window counters for the per-IP+identifier limiter
 *   (`lib/auth/identifier-limit.ts`); rows older than 24 h are pruned by the
 *   Scheduler in spec 05.
 * - `email_outbox`: emails captured by `CaptureTransport` in test mode only.
 *
 * Every timestamp is `timestamptz` (tech.md coding standards).
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/** `notification_prefs` shape; spec 05 narrows it to per-type preferences. */
export type NotificationPrefs = Record<string, unknown>;

export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** IANA zone; null until the browser reports one (F1-R8.5). */
  timezone: text("timezone"),
  dailyTargetMinutes: integer("daily_target_minutes").notNull().default(120),
  analysisEnabled: boolean("analysis_enabled").notNull().default(false),
  analysisAudioEnabled: boolean("analysis_audio_enabled")
    .notNull()
    .default(false),
  analysisConsentedAt: timestamp("analysis_consented_at", {
    withTimezone: true,
    mode: "date",
  }),
  deepWorkBlockMinutes: integer("deep_work_block_minutes")
    .notNull()
    .default(25),
  leaderboardEnabled: boolean("leaderboard_enabled").notNull().default(false),
  shareReportsDefault: boolean("share_reports_default")
    .notNull()
    .default(false),
  notificationPrefs: jsonb("notification_prefs")
    .$type<NotificationPrefs>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const authAttempts = pgTable("auth_attempts", {
  /** `sha256(scope | ip | normalizedIdentifier)`; never the raw identifier. */
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("email_outbox_to_email_idx").on(table.toEmail)],
);

export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
export type AuthAttempt = typeof authAttempts.$inferSelect;
export type NewAuthAttempt = typeof authAttempts.$inferInsert;
export type EmailOutboxRow = typeof emailOutbox.$inferSelect;
export type NewEmailOutboxRow = typeof emailOutbox.$inferInsert;

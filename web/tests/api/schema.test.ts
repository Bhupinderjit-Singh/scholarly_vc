// F1-R1.2, F1-R8.1, F1-R11.2 against a real Postgres: the first migration
// has been applied to `DATABASE_URL_TEST`, the Drizzle tables round-trip
// through it, the database fills the `user_settings` defaults, and deleting
// a user removes every dependent row through `ON DELETE CASCADE`.
//
// Skips without `DATABASE_URL_TEST`, and skips with a notice when the
// database exists but has not been migrated yet.
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "@/lib/db/client";
import { account, session, user, userSettings } from "@/lib/db/schema";
import { getTestPool, hasTestDatabase } from "./setup";

const EXPECTED_TABLES = [
  "account",
  "auth_attempts",
  "email_outbox",
  "rate_limit",
  "session",
  "user",
  "user_settings",
  "verification",
];

const NOT_MIGRATED =
  'user_settings does not exist: run the migration against DATABASE_URL_TEST (DATABASE_URL="$DATABASE_URL_TEST" npm run db:migrate)';

async function publicTables(): Promise<string[]> {
  const { rows } = await getTestPool().query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
  );
  return rows.map((row) => row.table_name);
}

describe.skipIf(!hasTestDatabase())("F1-R1.2 migrated test database", () => {
  let migrated = false;
  let db: Db;

  beforeAll(async () => {
    migrated = (await publicTables()).includes("user_settings");
    db = createDb(getTestPool());
  });

  it("contains the eight tables of the first migration", async (ctx) => {
    ctx.skip(!migrated, NOT_MIGRATED);
    expect(await publicTables()).toEqual(
      expect.arrayContaining(EXPECTED_TABLES),
    );
  });

  it("declares ON DELETE CASCADE on every foreign key to user (F1-R11.2)", async (ctx) => {
    ctx.skip(!migrated, NOT_MIGRATED);
    const { rows } = await getTestPool().query<{
      table_name: string;
      delete_rule: string;
    }>(
      `SELECT tc.table_name, rc.delete_rule
         FROM information_schema.referential_constraints rc
         JOIN information_schema.table_constraints tc
           ON tc.constraint_name = rc.constraint_name
          AND tc.constraint_schema = rc.constraint_schema
         JOIN information_schema.constraint_column_usage ccu
           ON ccu.constraint_name = rc.unique_constraint_name
          AND ccu.constraint_schema = rc.unique_constraint_schema
        WHERE tc.table_schema = 'public'
          AND ccu.table_name = 'user'
          AND ccu.column_name = 'id'
        ORDER BY tc.table_name`,
    );
    expect(rows.map((row) => row.table_name)).toEqual([
      "account",
      "session",
      "user_settings",
    ]);
    for (const row of rows) {
      expect(row.delete_rule, row.table_name).toBe("CASCADE");
    }
  });

  it("fills user_settings defaults in the database (F1-R8.1)", async (ctx) => {
    ctx.skip(!migrated, NOT_MIGRATED);
    const [created] = await db
      .insert(user)
      .values({ id: "u_defaults", name: "Defaults", email: "d@example.test" })
      .returning();
    expect(created?.emailVerified).toBe(false);
    expect(created?.createdAt).toBeInstanceOf(Date);

    const [settings] = await db
      .insert(userSettings)
      .values({ userId: "u_defaults" })
      .returning();
    expect(settings).toMatchObject({
      userId: "u_defaults",
      timezone: null,
      dailyTargetMinutes: 120,
      analysisEnabled: false,
      analysisAudioEnabled: false,
      analysisConsentedAt: null,
      deepWorkBlockMinutes: 25,
      leaderboardEnabled: false,
      shareReportsDefault: false,
      notificationPrefs: {},
    });
    expect(settings?.createdAt).toBeInstanceOf(Date);

    await db.delete(user).where(eq(user.id, "u_defaults"));
  });

  it("removes settings, sessions and accounts when the user is deleted (F1-R11.2)", async (ctx) => {
    ctx.skip(!migrated, NOT_MIGRATED);
    const userId = "u_cascade";
    const expiresAt = new Date(Date.now() + 60_000);
    await db
      .insert(user)
      .values({ id: userId, name: "Cascade", email: "c@example.test" });
    await db.insert(userSettings).values({ userId, timezone: "Asia/Kolkata" });
    await db.insert(session).values({
      id: "s_cascade",
      token: "token_cascade",
      userId,
      expiresAt,
      updatedAt: new Date(),
    });
    await db.insert(account).values({
      id: "a_cascade",
      accountId: userId,
      providerId: "credential",
      userId,
      password: "scrypt-hash-placeholder",
      updatedAt: new Date(),
    });

    await db.delete(user).where(eq(user.id, userId));

    expect(
      await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId)),
    ).toEqual([]);
    expect(
      await db.select().from(session).where(eq(session.userId, userId)),
    ).toEqual([]);
    expect(
      await db.select().from(account).where(eq(account.userId, userId)),
    ).toEqual([]);
  });
});

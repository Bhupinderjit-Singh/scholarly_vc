// F1-R1.2 (schema and checked-in migration), F1-R8.1 (user_settings
// defaults), F1-R11.2 (every foreign key to user cascades on delete).
//
// Two layers: the Drizzle table objects that the app and the Better Auth
// adapter use, and the generated SQL in `lib/db/migrations`, which is what
// the database actually gets. Both must agree with the design's Data Models.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "@/lib/db/schema";

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../lib/db/migrations/", import.meta.url),
);

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

/** Tables referencing `user.id`, all of which must cascade (F1-R11.2). */
const TABLES_REFERENCING_USER = ["account", "session", "user_settings"];

// The namespace also exports `relations()` objects and types; keep the tables.
const exported: unknown[] = Object.values(schema);
const tables = exported.filter((value): value is PgTable => is(value, PgTable));
const configs = tables.map((table) => getTableConfig(table));

function config(name: string): ReturnType<typeof getTableConfig> {
  const found = configs.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`table ${name} not in schema`);
  return found;
}

function column(
  tableName: string,
  columnName: string,
): ReturnType<typeof getTableConfig>["columns"][number] {
  const found = config(tableName).columns.find(
    (candidate) => candidate.name === columnName,
  );
  if (found === undefined) {
    throw new Error(`column ${tableName}.${columnName} not in schema`);
  }
  return found;
}

function columnNames(tableName: string): string[] {
  return config(tableName)
    .columns.map((candidate) => candidate.name)
    .sort();
}

describe("F1-R1.2 Drizzle schema", () => {
  it("defines exactly the eight tables of spec 01", () => {
    expect(configs.map((candidate) => candidate.name).sort()).toEqual(
      EXPECTED_TABLES,
    );
  });

  it("has the Better Auth columns from the design, in snake_case", () => {
    expect(columnNames("user")).toEqual([
      "created_at",
      "display_username",
      "email",
      "email_verified",
      "id",
      "image",
      "name",
      "updated_at",
      "username",
    ]);
    expect(columnNames("session")).toEqual([
      "created_at",
      "expires_at",
      "id",
      "ip_address",
      "token",
      "updated_at",
      "user_agent",
      "user_id",
    ]);
    expect(columnNames("account")).toEqual([
      "access_token",
      "access_token_expires_at",
      "account_id",
      "created_at",
      "id",
      "id_token",
      "password",
      "provider_id",
      "refresh_token",
      "refresh_token_expires_at",
      "scope",
      "updated_at",
      "user_id",
    ]);
    expect(columnNames("verification")).toEqual([
      "created_at",
      "expires_at",
      "id",
      "identifier",
      "updated_at",
      "value",
    ]);
    expect(columnNames("rate_limit")).toEqual([
      "count",
      "id",
      "key",
      "last_request",
    ]);
    expect(column("rate_limit", "last_request").getSQLType()).toBe("bigint");
  });

  it("has the application columns from the design", () => {
    expect(columnNames("user_settings")).toEqual([
      "analysis_audio_enabled",
      "analysis_consented_at",
      "analysis_enabled",
      "created_at",
      "daily_target_minutes",
      "deep_work_block_minutes",
      "leaderboard_enabled",
      "notification_prefs",
      "share_reports_default",
      "timezone",
      "updated_at",
      "user_id",
    ]);
    expect(columnNames("auth_attempts")).toEqual([
      "count",
      "key",
      "window_start",
    ]);
    expect(columnNames("email_outbox")).toEqual([
      "created_at",
      "html",
      "id",
      "subject",
      "text",
      "to_email",
    ]);
  });

  it("uses snake_case for every table and column name", () => {
    for (const candidate of configs) {
      expect(candidate.name).toMatch(/^[a-z][a-z0-9_]*$/);
      for (const col of candidate.columns) {
        expect(col.name).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    }
  });

  it("keeps the unique identifiers unique: email, username, token, key", () => {
    expect(column("user", "email").isUnique).toBe(true);
    expect(column("user", "username").isUnique).toBe(true);
    expect(column("session", "token").isUnique).toBe(true);
    expect(column("rate_limit", "key").isUnique).toBe(true);
    // username is optional at the database level: Google sign-ups get one
    // derived in `databaseHooks.user.create.before` (F1-R3.2).
    expect(column("user", "username").notNull).toBe(false);
  });

  it("stores every timestamp as timestamptz", () => {
    const timestampColumns = configs.flatMap((candidate) =>
      candidate.columns
        .filter((col) => col.getSQLType().startsWith("timestamp"))
        .map((col) => `${candidate.name}.${col.name}`),
    );
    expect(timestampColumns.length).toBeGreaterThan(0);
    for (const candidate of configs) {
      for (const col of candidate.columns) {
        if (col.getSQLType().startsWith("timestamp")) {
          expect(col.getSQLType(), `${candidate.name}.${col.name}`).toBe(
            "timestamp with time zone",
          );
        }
      }
    }
  });

  it("indexes the lookups Better Auth performs", () => {
    const indexNames = (name: string): string[] =>
      config(name)
        .indexes.map((idx) => idx.config.name ?? "")
        .sort();
    expect(indexNames("session")).toEqual(["session_userId_idx"]);
    expect(indexNames("account")).toEqual(["account_userId_idx"]);
    expect(indexNames("verification")).toEqual(["verification_identifier_idx"]);
    expect(indexNames("email_outbox")).toEqual(["email_outbox_to_email_idx"]);
  });
});

describe("F1-R11.2 foreign keys to user cascade", () => {
  it("has a foreign key to user.id from session, account and user_settings", () => {
    const referencingTables = configs
      .filter((candidate) =>
        candidate.foreignKeys.some(
          (fk) => getTableConfig(fk.reference().foreignTable).name === "user",
        ),
      )
      .map((candidate) => candidate.name)
      .sort();
    expect(referencingTables).toEqual(TABLES_REFERENCING_USER);
  });

  it("uses ON DELETE CASCADE on every foreign key that targets user", () => {
    let checked = 0;
    for (const candidate of configs) {
      for (const fk of candidate.foreignKeys) {
        const reference = fk.reference();
        if (getTableConfig(reference.foreignTable).name !== "user") continue;
        checked += 1;
        expect(fk.onDelete, `${candidate.name}.${fk.getName()}`).toBe(
          "cascade",
        );
        expect(reference.foreignColumns.map((col) => col.name)).toEqual(["id"]);
        expect(reference.columns.map((col) => col.name)).toEqual(["user_id"]);
      }
    }
    expect(checked).toBe(TABLES_REFERENCING_USER.length);
  });

  it("makes user_id the primary key of user_settings (one row per user)", () => {
    expect(column("user_settings", "user_id").primary).toBe(true);
  });
});

describe("F1-R8.1 user_settings defaults", () => {
  it("defaults daily_target_minutes to 120 and deep_work_block_minutes to 25", () => {
    const target = column("user_settings", "daily_target_minutes");
    expect(target.hasDefault).toBe(true);
    expect(target.default).toBe(120);
    expect(target.notNull).toBe(true);

    const block = column("user_settings", "deep_work_block_minutes");
    expect(block.hasDefault).toBe(true);
    expect(block.default).toBe(25);
    expect(block.notNull).toBe(true);
  });

  it("defaults every Phase 2 flag to false and notification_prefs to {}", () => {
    for (const name of [
      "analysis_enabled",
      "analysis_audio_enabled",
      "leaderboard_enabled",
      "share_reports_default",
    ]) {
      const flag = column("user_settings", name);
      expect(flag.default, name).toBe(false);
      expect(flag.notNull, name).toBe(true);
    }
    const prefs = column("user_settings", "notification_prefs");
    expect(prefs.getSQLType()).toBe("jsonb");
    expect(prefs.default).toEqual({});
    expect(prefs.notNull).toBe(true);
  });

  it("leaves timezone and analysis_consented_at nullable", () => {
    expect(column("user_settings", "timezone").notNull).toBe(false);
    expect(column("user_settings", "analysis_consented_at").notNull).toBe(
      false,
    );
  });

  it("generates email_outbox.id in the database", () => {
    const id = column("email_outbox", "id");
    expect(id.getSQLType()).toBe("uuid");
    expect(id.primary).toBe(true);
    expect(id.hasDefault).toBe(true);
  });
});

describe("F1-R1.2 checked-in migration", () => {
  const sqlFiles = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const journal = JSON.parse(
    readFileSync(`${MIGRATIONS_DIR}meta/_journal.json`, "utf8"),
  ) as { entries: { idx: number; tag: string }[] };

  it("consists of exactly one migration so far, listed in the journal", () => {
    expect(sqlFiles).toHaveLength(1);
    expect(sqlFiles[0]).toMatch(/^0000_.*\.sql$/);
    expect(journal.entries).toHaveLength(1);
    expect(`${journal.entries[0]?.tag}.sql`).toBe(sqlFiles[0]);
    expect(readdirSync(`${MIGRATIONS_DIR}meta`)).toContain(
      "0000_snapshot.json",
    );
  });

  const sql = readFileSync(`${MIGRATIONS_DIR}${sqlFiles[0]}`, "utf8");

  it("creates the eight tables", () => {
    for (const table of EXPECTED_TABLES) {
      expect(sql).toContain(`CREATE TABLE "${table}" (`);
    }
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(EXPECTED_TABLES.length);
  });

  it('adds ON DELETE cascade to every REFERENCES "user"("id")', () => {
    const references = sql.match(
      /ALTER TABLE "(\w+)" ADD CONSTRAINT "\w+" FOREIGN KEY \("user_id"\) REFERENCES "public"\."user"\("id"\)[^;]*;/g,
    );
    expect(references).not.toBeNull();
    expect(
      references?.map((line) => /^ALTER TABLE "(\w+)"/.exec(line)?.[1]),
    ).toEqual(expect.arrayContaining(TABLES_REFERENCING_USER));
    expect(references).toHaveLength(TABLES_REFERENCING_USER.length);
    for (const line of references ?? []) {
      expect(line).toContain("ON DELETE cascade");
    }
    // No other reference to user slipped in without the cascade.
    const allUserReferences = sql.match(/REFERENCES "public"\."user"\("id"\)/g);
    expect(allUserReferences).toHaveLength(TABLES_REFERENCING_USER.length);
  });

  it("writes the design's defaults into SQL", () => {
    expect(sql).toContain(
      '"daily_target_minutes" integer DEFAULT 120 NOT NULL',
    );
    expect(sql).toContain(
      '"deep_work_block_minutes" integer DEFAULT 25 NOT NULL',
    );
    expect(sql).toContain(
      "\"notification_prefs\" jsonb DEFAULT '{}'::jsonb NOT NULL",
    );
    expect(sql).toContain(
      '"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL',
    );
    expect(sql).toContain('"email_verified" boolean DEFAULT false NOT NULL');
    expect(sql).toContain('"last_request" bigint NOT NULL');
    expect(sql).not.toContain("timestamp NOT NULL");
    expect(sql).not.toContain("timestamp DEFAULT");
    expect(sql).not.toContain("timestamp,");
  });

  it("declares the unique constraints and indexes", () => {
    expect(sql).toContain('CONSTRAINT "user_email_unique" UNIQUE("email")');
    expect(sql).toContain(
      'CONSTRAINT "user_username_unique" UNIQUE("username")',
    );
    expect(sql).toContain('CONSTRAINT "session_token_unique" UNIQUE("token")');
    expect(sql).toContain('CONSTRAINT "rate_limit_key_unique" UNIQUE("key")');
    for (const idx of [
      'CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id")',
      'CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id")',
      'CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier")',
      'CREATE INDEX "email_outbox_to_email_idx" ON "email_outbox" USING btree ("to_email")',
    ]) {
      expect(sql).toContain(idx);
    }
  });
});

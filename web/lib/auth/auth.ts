// Placeholder: task 3.2 replaces this file with the full configuration (lazy getAuth()).
//
// This instance exists only so `npx @better-auth/cli generate` can derive
// `lib/db/schema/auth.ts`: it declares exactly the options that shape the
// Better Auth tables (email + password, database-backed rate limiting, the
// `username` plugin) and nothing else. It reads no environment variable at
// import time and never connects: `pg` pools open connections lazily and no
// Better Auth endpoint is invoked here.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { createDb, createPool } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

const PLACEHOLDER_DATABASE_URL =
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export const auth = betterAuth({
  database: drizzleAdapter(createDb(createPool(PLACEHOLDER_DATABASE_URL)), {
    provider: "pg",
    schema,
  }),
  secret: "schema-generation-placeholder-secret-0000",
  baseURL: "http://localhost:3000",
  emailAndPassword: { enabled: true },
  rateLimit: { enabled: true, storage: "database" },
  plugins: [username({ minUsernameLength: 3, maxUsernameLength: 20 })],
});

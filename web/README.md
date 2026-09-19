# Scholarly web

The Next.js app for Scholarly (App Router, TypeScript strict, Tailwind CSS v4).
Product, stack, and layout conventions live in `../.kiro/steering/`.

## Requirements

- Node 22 (see `.nvmrc`; `.npmrc` sets `engine-strict` so the wrong version fails fast)
- npm 10+

## Setup

```bash
npm ci
cp .env.example .env   # then fill in real values
npm run dev
```

## Scripts

| Script            | What it does                                                     |
| ----------------- | ---------------------------------------------------------------- |
| `dev`             | Start the dev server                                             |
| `build` / `start` | Production build and server                                      |
| `lint`            | ESLint (Next.js config + typescript-eslint, Prettier-compatible) |
| `typecheck`       | `next typegen` then `tsc --noEmit`                               |
| `format`          | Prettier write; `format:check` verifies                          |
| `test:unit`       | Vitest `node` (lib) and `jsdom` (components) projects            |
| `test:api`        | Vitest `api` project (route handlers against a test Postgres)    |
| `test:e2e`        | Playwright against `next build && next start`                    |
| `db:generate`     | `drizzle-kit generate` migrations                                |
| `db:migrate`      | `drizzle-kit migrate`                                            |

Playwright needs a browser once: `npx playwright install chromium`.

## Database

Neon Postgres through `pg` + Drizzle (`lib/db/client.ts`); nothing is
installed locally, and there is no Docker. Branches replace local databases:

1. Create a free [Neon](https://neon.tech) project. Its `main` branch is
   production.
2. In the project, create two branches from `main`: `dev` and `test`.
3. Copy each branch's **pooled** connection string (it ends in
   `?sslmode=require&channel_binding=require`) into `web/.env`:
   `DATABASE_URL` = `dev`, `DATABASE_URL_TEST` = `test`.
4. Migrate both branches:

   ```bash
   npm run db:migrate                                 # dev branch
   DATABASE_URL="$DATABASE_URL_TEST" npm run db:migrate   # test branch
   ```

   `drizzle-kit` reads `web/.env` by itself; a variable set in the shell wins
   over the file. A `db:migrate:test` script may be added later.

`npm run test:api` runs against `DATABASE_URL_TEST` and truncates every table
in `public` before each test file (`tests/api/setup.ts`), so never point it at
the `dev` branch; the setup refuses to run when it equals `DATABASE_URL`. With
`DATABASE_URL_TEST` unset, database-backed tests skip with a notice and the
rest still run. CI sets it to a Postgres 16 service container.

TLS is decided from the URL's `sslmode` and set explicitly on the pool
(`resolveConnection` in `lib/db/client.ts` explains why). `GET /api/health`
runs `SELECT 1` with a 2 s timeout and answers `200 { status: "ok", db: "ok" }`
or `503 { status: "degraded", db: "unreachable" }`.

## Environment and logging

`lib/env.ts` validates `process.env` with Zod (`getEnv()`, cached after the
first call). `instrumentation.ts` calls it when the server starts; on an
invalid environment it logs one JSON line, `{"event":"env.invalid",
"variables":[...]}`, with the offending variable names only, and rethrows.
`next start` then answers every request with 500 (Next keeps the process
alive); on Vercel the function fails. `next build` never runs the check, so
it works without a `.env`.

`lib/log.ts` writes one JSON object per line (`log.info|warn|error(event,
fields)`). `redact` removes any key containing `email`, `name`, `password`,
`token` or `cookie`, so log user ids and route names, never usernames or
addresses.

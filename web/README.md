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

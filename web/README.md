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

import { getPool } from "@/lib/db/client";
import { handleHealth } from "@/lib/db/health";

/**
 * GET /api/health (requirement F1-R1.4): a database round-trip with a 2 s
 * timeout. `200 { status: "ok", db: "ok" }` or
 * `503 { status: "degraded", db: "unreachable" }`, `Cache-Control: no-store`.
 *
 * Node runtime because `pg` needs TCP sockets; `force-dynamic` so the route
 * is never prerendered (no database is contacted during `next build`).
 * The handler body lives in `lib/db/health.ts` so API tests can call it
 * with their own pool.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleHealth(request, getPool());
}

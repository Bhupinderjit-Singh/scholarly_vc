import { getRequestId, log } from "@/lib/log";

/**
 * Database health check behind `GET /api/health` (requirement F1-R1.4).
 *
 * Kept out of the route file so tests can run the exact handler against a
 * pool that points at a closed port, or a fake pool whose query never
 * settles, without booting Next.
 */

/** The route must answer within 2 s even when the database is unreachable. */
export const DEFAULT_HEALTH_TIMEOUT_MS = 2000;

export const HEALTH_ROUTE = "/api/health";

export type DbStatus = "ok" | "unreachable";

export type HealthBody =
  { status: "ok"; db: "ok" } | { status: "degraded"; db: "unreachable" };

/** The part of `pg.Pool` the check uses; lets tests substitute a fake. */
export interface HealthQueryable {
  query(text: string): Promise<unknown>;
}

/**
 * `SELECT 1` through the pool, raced against a timer. `pg` does not take an
 * `AbortSignal`, so a query that outlives the timer keeps running in the
 * background until `pg`'s own connection timeout or the server answers. Its
 * promise has both `then` handlers attached before the race, so a late
 * failure is absorbed rather than becoming an unhandled rejection, and
 * `pool.query` releases its client itself once the query settles, so no
 * client is left checked out. The timer is always cleared.
 *
 * Failures are logged with the error's name, message and `code` only; the
 * connection string is never part of the log line.
 */
export async function checkDatabase(
  pool: HealthQueryable,
  timeoutMs: number = DEFAULT_HEALTH_TIMEOUT_MS,
): Promise<DbStatus> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  const query: Promise<"ok" | { failed: unknown }> = pool
    .query("SELECT 1")
    .then(
      () => "ok" as const,
      (error: unknown) => ({ failed: error }),
    );

  try {
    const outcome = await Promise.race([query, timeout]);
    if (outcome === "ok") return "ok";
    if (outcome === "timeout") {
      log.warn("health.db_unreachable", { reason: "timeout", timeoutMs });
    } else {
      log.warn("health.db_unreachable", {
        reason: "error",
        error: outcome.failed,
        code: errorCode(outcome.failed),
      });
    }
    return "unreachable";
  } finally {
    clearTimeout(timer);
  }
}

/** `pg` errors carry a `code` (`ECONNREFUSED`, `28P01`, ...) that is safe to log. */
function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error as { code: unknown };
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

/**
 * The health response: `200 { status: "ok", db: "ok" }` or
 * `503 { status: "degraded", db: "unreachable" }`, never cached, plus one
 * log line with the request id, route, status and duration.
 */
export async function handleHealth(
  request: Request,
  pool: HealthQueryable,
  timeoutMs: number = DEFAULT_HEALTH_TIMEOUT_MS,
): Promise<Response> {
  const startedAt = performance.now();
  const requestId = getRequestId(request.headers);

  const db = await checkDatabase(pool, timeoutMs);
  const body: HealthBody =
    db === "ok"
      ? { status: "ok", db: "ok" }
      : { status: "degraded", db: "unreachable" };
  const status = db === "ok" ? 200 : 503;

  log.info("health.request", {
    requestId,
    route: HEALTH_ROUTE,
    status,
    durationMs: Math.round(performance.now() - startedAt),
  });

  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

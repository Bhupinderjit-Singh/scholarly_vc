/**
 * Next.js instrumentation hook (picked up automatically from the project root).
 *
 * `register()` runs once per server instance before the first request and is
 * skipped by `next build`, so this is where the server validates its
 * configuration and refuses to start when it is invalid (F1-R1.3). Only the
 * offending variable names are logged, never values.
 */
export async function register(): Promise<void> {
  // Next calls register() in every runtime. Only the Node.js server has the
  // full environment, and the Edge runtime must not load Node-only modules,
  // so the imports stay dynamic and behind this guard.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const [{ EnvValidationError, getEnv }, { log }] = await Promise.all([
    import("@/lib/env"),
    import("@/lib/log"),
  ]);

  try {
    const env = getEnv();
    // Field names avoid the redacted words (`emailTransport` would be stripped).
    log.info("env.valid", {
      nodeEnv: env.NODE_ENV,
      transport: env.EMAIL_TRANSPORT,
      registrationOpen: env.REGISTRATION_OPEN,
    });
  } catch (error) {
    if (error instanceof EnvValidationError) {
      log.error("env.invalid", { variables: error.variables });
    }
    throw error;
  }
}

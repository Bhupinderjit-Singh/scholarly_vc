import type { NextConfig } from "next";

import { SECURITY_HEADERS } from "./lib/security/headers";

// Next.js 16 transpiles this file with SWC and hooks `require` so relative
// TypeScript imports such as `./lib/security/headers` load too (verified in
// `next/dist/build/next-config-ts/transpile-config.js`). Keep the imported
// module side-effect free: it runs while the config is being loaded.
const nextConfig: NextConfig = {
  /**
   * Static security headers on every response (tech.md "Security"). The
   * per-request `Content-Security-Policy` is set in `proxy.ts`.
   */
  async headers() {
    return [{ source: "/(.*)", headers: [...SECURITY_HEADERS] }];
  },
};

export default nextConfig;

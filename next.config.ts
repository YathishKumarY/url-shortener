import type { NextConfig } from "next";

/**
 * Baseline security headers.
 *
 * No CSP is set here: the app relies on Next's inline bootstrap scripts and
 * styled-jsx, so a meaningful policy needs per-request nonces rather than a
 * static header. The headers below are the ones that are safe to apply
 * globally without breaking the app.
 */
const securityHeaders = [
  // Block MIME sniffing, which is what turns an uploaded image into a script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Deny framing: the dashboard and notice pages should never be embedded in a
  // third-party page. (This does not stop the cloaking page from framing the
  // destination - it only controls who may frame *us*.)
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

/**
 * Send only the origin cross-site, so reset and verification tokens in a
 * query string are not leaked to third parties via Referer.
 *
 * Scoped to app pages rather than every path: config headers override what a
 * route handler sets, and short links must be able to send
 * `Referrer-Policy: no-referrer` when the owner hides the referrer. Browsers
 * already default to strict-origin-when-cross-origin for everything else.
 */
const referrerPolicy = [{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }];
const APP_PAGES = [
  "/",
  "/auth/:path*",
  "/dashboard/:path*",
  "/admin/:path*",
  "/docs/:path*",
  "/api/:path*",
];

const nextConfig: NextConfig = {
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(",").map((o) => o.trim()) ?? [],
  // Self-hosting: `STANDALONE=true npm run build` emits a minimal server
  // bundle for the Docker image. Left off by default so Vercel builds are
  // unchanged.
  output: process.env.STANDALONE === "true" ? "standalone" : undefined,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      ...APP_PAGES.map((source) => ({ source, headers: referrerPolicy })),
    ];
  },
};

export default nextConfig;

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
  // Deny framing: the redirect interstitials and dashboard should never be
  // embedded in a third-party page.
  { key: "X-Frame-Options", value: "DENY" },
  // Send only the origin cross-site, so reset and verification tokens in a
  // query string are not leaked to third parties via Referer.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(",").map((o) => o.trim()) ?? [],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

const FALLBACK_ORIGIN = "http://localhost:3000";

function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    // Accept bare hosts ("example.com") as well as full origins.
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
}

/**
 * Resolve the public origin of the app.
 *
 * `new URL(request.url).origin` is not reliable on a serverless platform or
 * behind a reverse proxy: the inbound request often carries an internal host
 * (and plain http), so the short URL baked into a QR code would point at an
 * address the scanning phone cannot reach. Prefer explicit configuration, then
 * the forwarded headers the proxy sets, and only then the raw request URL.
 */
export function getAppOrigin(request?: Request): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (configured) {
    const origin = normalizeOrigin(configured);
    if (origin) return origin;
  }

  if (request) {
    const forwardedHost =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? null;
    if (forwardedHost) {
      const proto =
        request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
        (forwardedHost.startsWith("localhost") || forwardedHost.startsWith("127.0.0.1")
          ? "http"
          : "https");
      const origin = normalizeOrigin(`${proto}://${forwardedHost}`);
      if (origin) return origin;
    }

    const origin = normalizeOrigin(new URL(request.url).origin);
    if (origin) return origin;
  }

  return FALLBACK_ORIGIN;
}

/** Build the public short URL for a short code. */
export function buildShortUrl(shortCode: string, request?: Request): string {
  return `${getAppOrigin(request)}/${shortCode}`;
}

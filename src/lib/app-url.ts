import { config } from "@/lib/config";

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
  // `||` rather than `??`: a blank NEXT_PUBLIC_APP_URL= should still fall
  // through to AUTH_URL.
  const configured =
    process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || process.env.NEXTAUTH_URL;
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

/** Host (with port, if any) of the app's own domain. */
export function getAppHost(request?: Request): string {
  return new URL(getAppOrigin(request)).host;
}

type ShortUrlOptions = Request | { domain?: string | null; request?: Request } | undefined;

function resolveOrigin(options: ShortUrlOptions): string {
  if (options instanceof Request) return getAppOrigin(options);
  if (options?.domain) return `${config.customDomainProtocol}://${options.domain}`;
  return getAppOrigin(options?.request);
}

/**
 * Build the public short URL for a short code.
 *
 * The code is percent-encoded so emoji and other non-ASCII aliases produce a
 * valid URL; plain alphanumeric codes are unchanged by the encoding.
 */
export function buildShortUrl(shortCode: string, options?: ShortUrlOptions): string {
  return `${resolveOrigin(options)}/${encodeURIComponent(shortCode)}`;
}

/** Human-friendly short URL: no scheme, and the code left unencoded. */
export function displayShortUrl(shortCode: string, options?: ShortUrlOptions): string {
  return `${resolveOrigin(options).replace(/^https?:\/\//, "")}/${shortCode}`;
}

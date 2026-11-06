/** Route-param and query-string helpers shared by the public link pages. */

type SearchValue = string | string[] | undefined;

const ESCAPE = /%[0-9a-f]{2}/i;
const HOSTNAME = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

/**
 * Decode a short code taken from a route segment. Emoji and other non-ASCII
 * codes arrive percent-encoded; a malformed escape is kept exactly as typed
 * rather than crashing the page.
 */
export function decodeCode(raw: string): string {
  if (!ESCAPE.test(raw)) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Whether a decoded code is worth looking up (same bound as the redirect handler). */
export function isPlausibleCode(code: string): boolean {
  return code.length > 0 && Array.from(code).length <= 100;
}

/** First value of a search param that may be repeated (`?a=1&a=2`). */
export function firstParam(value: SearchValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A short code from a notice page's `?code=`, or null when absent or implausible. */
export function codeParam(value: SearchValue): string | null {
  const code = firstParam(value)?.trim();
  return code && isPlausibleCode(code) ? code : null;
}

/** A custom-domain hostname from `?domain=`, or "" for the app's own domain. */
export function domainParam(value: SearchValue): string {
  const domain = firstParam(value)?.trim().toLowerCase() ?? "";
  return domain.length <= 253 && HOSTNAME.test(domain) ? domain : "";
}

/** Path of a short link on the current host. Encoding keeps it on this host. */
export function shortPath(code: string): string {
  return `/${encodeURIComponent(code)}`;
}

// Shared helpers for the popup, options page and background worker.

export const DEFAULT_INSTANCE = "http://localhost:3000";

/** Turn user input into a bare origin ("https://host[:port]"), or null. */
export function normalizeOrigin(input) {
  let raw = String(input || "").trim();
  if (!raw) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    const local = /^(localhost|127\.0\.0\.1)(:|\/|$)/i.test(raw);
    raw = (local ? "http://" : "https://") + raw;
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function getSettings() {
  const { instance, apiKey } = await chrome.storage.sync.get(["instance", "apiKey"]);
  if (!instance || !apiKey) return null;
  return { instance, apiKey };
}

export function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function readError(res) {
  let message = "";
  try {
    const body = await res.json();
    if (body && typeof body.error === "string") message = body.error;
  } catch {
    /* non-JSON body */
  }
  if (message) return message;
  if (res.status === 401) return "Invalid or missing API key.";
  if (res.status === 429) return "Rate limit reached. Try again in a moment.";
  return `Request failed (HTTP ${res.status}).`;
}

async function request(settings, path, init = {}) {
  let res;
  try {
    res = await fetch(settings.instance + path, {
      ...init,
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch {
    throw new Error(
      `Could not reach ${settings.instance}. Check the instance URL and that host access was granted in settings.`,
    );
  }
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/** Create a short link. Returns the API response (shortUrl, shortCode, domain, id, ...). */
export function shorten(settings, url, customAlias) {
  const body = { url };
  if (customAlias) body.customAlias = customAlias;
  return request(settings, "/api/v1/links", { method: "POST", body: JSON.stringify(body) });
}

/** Cheap authenticated call used to validate the key. */
export function validateKey(settings) {
  return request(settings, "/api/v1/links?limit=1");
}

export function qrUrl(instance, link) {
  let url = `${instance}/api/qr/${encodeURIComponent(link.shortCode)}?size=256`;
  if (link.domain) url += `&domain=${encodeURIComponent(link.domain)}`;
  return url;
}

export function dashboardLinkUrl(instance, link) {
  return `${instance}/dashboard/links/${encodeURIComponent(link.id)}`;
}

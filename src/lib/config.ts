/**
 * Runtime feature flags and limits, read from the environment.
 *
 * Getters rather than constants so values are read at call time: tests can
 * change process.env between cases, and a redeploy with new env vars never
 * needs a rebuild to take effect.
 */

function flag(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function list(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function int(name: string, fallback: number, min: number, max: number): number {
  // Number("") is 0, so a blank value would otherwise clamp to the minimum.
  if (!process.env[name]?.trim()) return fallback;
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export type GeolocationProvider = "none" | "ip-api" | "ipinfo";

export const config = {
  /** Display name used in emails, page titles and the API. */
  get siteName(): string {
    return process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "Linkly";
  },

  /** Stop new accounts from being created (existing users can still sign in). */
  get registrationDisabled(): boolean {
    return flag("DISABLE_REGISTRATION");
  },

  /** Require an account (or API key) to create links. */
  get anonymousLinksDisabled(): boolean {
    return flag("DISABLE_ANONYMOUS_LINKS");
  },

  /**
   * Restrict destinations to these domains and their subdomains, like the
   * Wikimedia shortener that only accepts Wikimedia links. Empty = any domain.
   */
  get allowedDomains(): string[] {
    return list("ALLOWED_DOMAINS");
  },

  /** Accounts with these emails are promoted to admin when they sign in. */
  get adminEmails(): string[] {
    return list("ADMIN_EMAILS");
  },

  /** Length of generated short codes. */
  get shortCodeLength(): number {
    return int("SHORT_CODE_LENGTH", 7, 4, 16);
  },

  /**
   * Allow server-side fetches (page metadata, webhooks) to reach private and
   * loopback addresses. Off by default: with it on, any user could make the
   * server probe the internal network.
   */
  get allowPrivateNetworkFetch(): boolean {
    return flag("ALLOW_PRIVATE_NETWORK_FETCH");
  },

  /**
   * Fallback IP geolocation when the platform sends no country header.
   * "none" by default, because the alternatives send visitor IPs to a third
   * party.
   */
  get geolocationProvider(): GeolocationProvider {
    const value = (process.env.GEOLOCATION_PROVIDER ?? "none").trim().toLowerCase();
    return value === "ip-api" || value === "ipinfo" ? value : "none";
  },

  get ipinfoToken(): string | null {
    return process.env.IPINFO_TOKEN?.trim() || null;
  },

  /** Google Safe Browsing v4 key. When set, destinations are screened on save. */
  get safeBrowsingKey(): string | null {
    return process.env.GOOGLE_SAFE_BROWSING_API_KEY?.trim() || null;
  },

  /** Protocol for links on custom domains. Only change it for local testing. */
  get customDomainProtocol(): "https" | "http" {
    return process.env.CUSTOM_DOMAIN_PROTOCOL?.trim().toLowerCase() === "http" ? "http" : "https";
  },

  /** Maximum links per bulk request. */
  get bulkLimit(): number {
    return int("BULK_LINK_LIMIT", 100, 1, 1000);
  },
};

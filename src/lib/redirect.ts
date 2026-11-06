import type { Link } from "@/generated/prisma/client";
import type { DeviceOs } from "@/lib/visitor";

/**
 * Pure redirect decision logic, kept free of I/O so every rule is unit
 * testable. The route handler loads the link, asks this module what to do,
 * and performs the side effects (counting, recording, responding).
 */

export interface RedirectVariant {
  url: string;
  weight: number;
}

/** Everything the redirect path needs, in a JSON-safe shape for the cache. */
export interface RedirectLink {
  v: 2;
  id: string;
  userId: string | null;
  domain: string;
  shortCode: string;
  url: string;
  title: string | null;
  /** Epoch ms, or null. */
  expiresAt: number | null;
  startsAt: number | null;
  maxClicks: number | null;
  disabled: boolean;
  banned: boolean;
  hasPassword: boolean;
  expiredUrl: string | null;
  redirectType: 301 | 302 | 307 | 308;
  forwardQuery: boolean;
  hideReferrer: boolean;
  cloaked: boolean;
  /** Count the click but store no visitor details. */
  noLog: boolean;
  iosUrl: string | null;
  androidUrl: string | null;
  geoTargets: Record<string, string> | null;
  abVariants: RedirectVariant[] | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
}

const REDIRECT_TYPES = new Set([301, 302, 307, 308]);

function asRedirectType(value: number): RedirectLink["redirectType"] {
  return REDIRECT_TYPES.has(value) ? (value as RedirectLink["redirectType"]) : 302;
}

export function parseGeoTargets(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string] =>
      /^[A-Z]{2}$/.test(entry[0]) && typeof entry[1] === "string" && entry[1].length > 0,
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export function parseVariants(value: unknown): RedirectVariant[] | null {
  if (!Array.isArray(value)) return null;
  const variants = value.filter(
    (v): v is RedirectVariant =>
      !!v &&
      typeof v === "object" &&
      typeof (v as RedirectVariant).url === "string" &&
      typeof (v as RedirectVariant).weight === "number" &&
      (v as RedirectVariant).weight > 0,
  );
  return variants.length >= 2 ? variants : null;
}

export function toRedirectLink(
  link: Link & { user?: { bannedAt: Date | null } | null },
): RedirectLink {
  return {
    v: 2,
    id: link.id,
    userId: link.userId,
    domain: link.domain,
    shortCode: link.shortCode,
    url: link.originalUrl,
    title: link.title,
    expiresAt: link.expiresAt ? link.expiresAt.getTime() : null,
    startsAt: link.startsAt ? link.startsAt.getTime() : null,
    maxClicks: link.maxClicks,
    disabled: link.disabled,
    banned: !!link.bannedAt || !!link.user?.bannedAt,
    hasPassword: !!link.password,
    expiredUrl: link.expiredUrl,
    redirectType: asRedirectType(link.redirectType),
    forwardQuery: link.forwardQuery,
    hideReferrer: link.hideReferrer,
    cloaked: link.cloaked,
    noLog: link.noLog,
    iosUrl: link.iosUrl,
    androidUrl: link.androidUrl,
    geoTargets: parseGeoTargets(link.geoTargets),
    abVariants: parseVariants(link.abVariants),
    ogTitle: link.ogTitle,
    ogDescription: link.ogDescription,
    ogImage: link.ogImage,
  };
}

/**
 * Validate a cached value. Entries written by older builds (bare URL strings,
 * or the v1 `{id, originalUrl, expiresAt}` shape) are treated as a miss so
 * they get rewritten with every rule the current redirect path enforces.
 */
export function parseCachedRedirectLink(value: unknown): RedirectLink | null {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<RedirectLink>;
  if (candidate.v !== 2 || typeof candidate.id !== "string" || typeof candidate.url !== "string") {
    return null;
  }
  return candidate as RedirectLink;
}

export type Gate =
  | { kind: "ok" }
  | { kind: "banned" }
  | { kind: "disabled" }
  | { kind: "scheduled"; startsAt: number }
  | { kind: "expired"; reason: "expired" | "limit"; fallback: string | null };

/**
 * Rules that can be decided from the link alone. The click limit needs the
 * live counter, so the route checks it separately (atomically).
 */
export function evaluateGates(link: RedirectLink, now = Date.now()): Gate {
  if (link.banned) return { kind: "banned" };
  if (link.disabled) return { kind: "disabled" };
  if (link.startsAt !== null && link.startsAt > now) {
    return { kind: "scheduled", startsAt: link.startsAt };
  }
  if (link.expiresAt !== null && link.expiresAt <= now) {
    return { kind: "expired", reason: "expired", fallback: link.expiredUrl };
  }
  return { kind: "ok" };
}

export interface TargetContext {
  platform: DeviceOs;
  country: string | null;
  /** Previously assigned A/B variant for this visitor (sticky cookie). */
  stickyVariant?: number | null;
  random?: () => number;
}

export interface Destination {
  url: string;
  /** Index of the A/B variant served, when an A/B test decided. */
  variant: number | null;
  reason: "ios" | "android" | "geo" | "ab" | "default";
}

/** Pick an index with probability proportional to its weight. `r` is in [0, 1). */
export function weightedPick(weights: number[], r: number): number {
  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (total <= 0) return 0;
  let target = r * total;
  for (let i = 0; i < weights.length; i++) {
    target -= Math.max(0, weights[i]);
    if (target < 0) return i;
  }
  return weights.length - 1;
}

/**
 * Device targeting wins over geo targeting, which wins over an A/B split.
 * The most specific signal decides: an iOS app link must open the App Store
 * listing even inside a geo-targeted campaign.
 */
export function pickDestination(link: RedirectLink, ctx: TargetContext): Destination {
  if (ctx.platform === "ios" && link.iosUrl) {
    return { url: link.iosUrl, variant: null, reason: "ios" };
  }
  if (ctx.platform === "android" && link.androidUrl) {
    return { url: link.androidUrl, variant: null, reason: "android" };
  }
  if (ctx.country && link.geoTargets?.[ctx.country]) {
    return { url: link.geoTargets[ctx.country], variant: null, reason: "geo" };
  }
  const variants = link.abVariants;
  if (variants && variants.length >= 2) {
    const sticky = ctx.stickyVariant;
    const index =
      sticky !== null && sticky !== undefined && sticky >= 0 && sticky < variants.length
        ? sticky
        : weightedPick(
            variants.map((v) => v.weight),
            (ctx.random ?? Math.random)(),
          );
    return { url: variants[index].url, variant: index, reason: "ab" };
  }
  return { url: link.url, variant: null, reason: "default" };
}

/** Params that steer the shortener itself and must not leak to the destination. */
export const INTERNAL_PARAMS = new Set(["qr", "pw", "src"]);

/**
 * Append the visitor's query string to the destination.
 *
 * When no key collides, the incoming pairs are appended as text so the
 * destination's own query is byte-for-byte untouched - re-serialising it
 * through URLSearchParams would rewrite `%20` as `+` and break signed URLs.
 * On a collision the incoming value wins, like Shlink and Dub.
 */
export function forwardQueryParams(destination: string, incoming: URLSearchParams): string {
  const entries = [...incoming.entries()].filter(([key]) => !INTERNAL_PARAMS.has(key));
  if (entries.length === 0) return destination;

  let url: URL;
  try {
    url = new URL(destination);
  } catch {
    return destination;
  }

  const incomingKeys = new Set(entries.map(([key]) => key));
  const collides = [...url.searchParams.keys()].some((key) => incomingKeys.has(key));

  if (!collides) {
    const extra = new URLSearchParams(entries).toString();
    const hashIndex = destination.indexOf("#");
    const base = hashIndex === -1 ? destination : destination.slice(0, hashIndex);
    const hash = hashIndex === -1 ? "" : destination.slice(hashIndex);
    const separator = base.includes("?")
      ? base.endsWith("?") || base.endsWith("&")
        ? ""
        : "&"
      : "?";
    return `${base}${separator}${extra}${hash}`;
  }

  for (const key of incomingKeys) url.searchParams.delete(key);
  for (const [key, value] of entries) url.searchParams.append(key, value);
  return url.toString();
}

/**
 * Link-preview crawlers get a card instead of a redirect when the owner set a
 * custom preview, or when the link is password protected - following it would
 * leak the destination's own title and image into the chat.
 */
export function shouldServePreviewCard(link: RedirectLink, isPreviewBot: boolean): boolean {
  if (!isPreviewBot) return false;
  return link.hasPassword || !!(link.ogTitle || link.ogDescription || link.ogImage);
}

/** How the visit was sourced, from the internal query markers. */
export function visitSource(params: URLSearchParams): "link" | "qr" | "bio" {
  if (params.get("qr") === "1") return "qr";
  if (params.get("src") === "bio") return "bio";
  return "link";
}

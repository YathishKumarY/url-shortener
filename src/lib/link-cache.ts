import { cacheDel, cacheGet, cacheSet } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { parseCachedRedirectLink, toRedirectLink, type RedirectLink } from "@/lib/redirect";

const CACHE_TTL_SECONDS = 86400;

export function linkCacheKey(domain: string, shortCode: string): string {
  return `link:v2:${domain}:${shortCode}`;
}

export async function cacheRedirectLink(link: RedirectLink): Promise<void> {
  // Never cache past the expiry instant: once it lapses the next request
  // should re-read the row (where the owner may have extended it).
  const ttl = link.expiresAt
    ? Math.min(CACHE_TTL_SECONDS, Math.ceil((link.expiresAt - Date.now()) / 1000))
    : CACHE_TTL_SECONDS;
  if (ttl > 0) await cacheSet(linkCacheKey(link.domain, link.shortCode), JSON.stringify(link), ttl);
}

export async function invalidateLinkCache(
  ...links: Array<{ domain: string; shortCode: string }>
): Promise<void> {
  const keys = new Set(links.map((l) => linkCacheKey(l.domain, l.shortCode)));
  await cacheDel(...keys);
}

/**
 * Resolve a short code: cache first, then Postgres. The cached value carries
 * every rule the redirect path enforces (expiry, schedule, targeting...) so a
 * hit never needs the database - except the click limit, which is checked
 * against the live counter.
 */
export async function loadRedirectLink(
  domain: string,
  shortCode: string,
): Promise<RedirectLink | null> {
  const cached = parseCachedRedirectLink(await cacheGet(linkCacheKey(domain, shortCode)));
  if (cached) return cached;

  const row = await prisma.link.findUnique({
    where: { domain_shortCode: { domain, shortCode } },
    include: { user: { select: { bannedAt: true } } },
  });
  if (!row) return null;

  const link = toRedirectLink(row);
  await cacheRedirectLink(link);
  return link;
}

/** Drop every cached link owned by a user, e.g. after banning them. */
export async function invalidateUserLinks(userId: string): Promise<void> {
  const links = await prisma.link.findMany({
    where: { userId },
    select: { domain: true, shortCode: true },
  });
  for (let i = 0; i < links.length; i += 500) {
    await invalidateLinkCache(...links.slice(i, i + 500));
  }
}

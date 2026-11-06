import { resolveTxt } from "node:dns/promises";
import { getAppHost } from "@/lib/app-url";
import { cacheDel, cacheGet, cacheSet } from "@/lib/cache";
import { prisma } from "@/lib/prisma";

export interface DomainSettings {
  hostname: string;
  userId: string;
  rootRedirect: string | null;
  notFoundRedirect: string | null;
}

const DOMAIN_CACHE_TTL = 60;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Hostname the visitor asked for, lower-cased and without the port. */
export function hostFromRequest(request: Request): string | null {
  const raw = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!raw) return null;
  const first = raw.split(",")[0].trim().toLowerCase();
  if (first.startsWith("[")) return first.slice(0, first.indexOf("]") + 1);
  return first.replace(/:\d+$/, "") || null;
}

export function isAppHost(host: string): boolean {
  if (LOCAL_HOSTS.has(host)) return true;
  return host === getAppHost().replace(/:\d+$/, "").toLowerCase();
}

function domainCacheKey(host: string) {
  return `domain:v1:${host}`;
}

/** Verified custom domain settings for a hostname, cached briefly. */
export async function getVerifiedDomain(host: string): Promise<DomainSettings | null> {
  const cached = await cacheGet(domainCacheKey(host));
  if (cached) {
    const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
    return parsed && typeof parsed === "object" && "hostname" in parsed
      ? (parsed as DomainSettings)
      : null; // cached negative lookup
  }

  const row = await prisma.domain.findUnique({ where: { hostname: host } });
  const settings: DomainSettings | null =
    row && row.verified
      ? {
          hostname: row.hostname,
          userId: row.userId,
          rootRedirect: row.rootRedirect,
          notFoundRedirect: row.notFoundRedirect,
        }
      : null;
  await cacheSet(
    domainCacheKey(host),
    JSON.stringify(settings ?? { none: true }),
    DOMAIN_CACHE_TTL,
  );
  return settings;
}

export async function invalidateDomainCache(host: string): Promise<void> {
  await cacheDel(domainCacheKey(host));
}

/**
 * Which link namespace a request belongs to: "" for the app's own domain, or
 * the hostname of a verified custom domain. Unverified or unknown hosts (a
 * preview deployment URL, a raw IP) fall back to the app's namespace.
 */
export async function resolveRequestDomain(
  request: Request,
): Promise<{ domain: string; settings: DomainSettings | null }> {
  const host = hostFromRequest(request);
  if (!host || isAppHost(host)) return { domain: "", settings: null };
  try {
    const settings = await getVerifiedDomain(host);
    return settings ? { domain: host, settings } : { domain: "", settings: null };
  } catch (err) {
    console.error("[domains] lookup failed:", err);
    return { domain: "", settings: null };
  }
}

export function verificationRecordName(hostname: string): string {
  return `_linkly-verify.${hostname}`;
}

export function verificationRecordValue(token: string): string {
  return `linkly-verify=${token}`;
}

/** Look for the TXT record proving the requester controls the domain's DNS. */
export async function checkDomainVerification(
  hostname: string,
  token: string,
): Promise<{ verified: boolean; message: string }> {
  try {
    const records = await resolveTxt(verificationRecordName(hostname));
    const values = records.map((chunks) => chunks.join(""));
    if (values.includes(verificationRecordValue(token))) {
      return { verified: true, message: "Domain verified" };
    }
    return {
      verified: false,
      message: `TXT record found, but it does not contain ${verificationRecordValue(token)}`,
    };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOTFOUND" || code === "ENODATA") {
      return {
        verified: false,
        message: `No TXT record at ${verificationRecordName(hostname)} yet. DNS changes can take a few minutes.`,
      };
    }
    return { verified: false, message: "DNS lookup failed. Please try again shortly." };
  }
}

export function serializeDomain(
  domain: {
    id: string;
    hostname: string;
    verified: boolean;
    verificationToken: string;
    verifiedAt: Date | null;
    rootRedirect: string | null;
    notFoundRedirect: string | null;
    createdAt: Date;
  },
  linkCount = 0,
) {
  const { verificationToken, ...rest } = domain;
  return {
    ...rest,
    linkCount,
    dns: {
      // Point the domain at the app so requests for it reach this server.
      routing: { type: "CNAME", name: domain.hostname, value: getAppHost().replace(/:\d+$/, "") },
      // Prove control of the domain's DNS.
      verification: {
        type: "TXT",
        name: verificationRecordName(domain.hostname),
        value: verificationRecordValue(verificationToken),
      },
    },
  };
}

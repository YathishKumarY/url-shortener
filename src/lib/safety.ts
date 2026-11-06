import { getAppHost } from "@/lib/app-url";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { RESERVED_SHORT_CODES } from "@/lib/validators";

export type SafetyResult = { ok: true } | { ok: false; reason: string };

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

/** The host itself plus every parent domain: a.b.example.com -> [a.b.example.com, b.example.com, example.com]. */
export function hostAndParents(host: string): string[] {
  const parts = host.split(".");
  const out: string[] = [];
  for (let i = 0; i < parts.length - 1; i++) out.push(parts.slice(i).join("."));
  return out;
}

export function matchesDomainList(host: string, list: string[]): boolean {
  return list.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

/**
 * A link to one of our own short URLs creates a chain (or, pointing at
 * itself, an infinite loop). App pages such as /@bio or /docs are fine.
 */
function isOwnShortLink(url: URL): boolean {
  const appHost = getAppHost().replace(/:\d+$/, "").toLowerCase();
  if (url.hostname.toLowerCase() !== appHost) return false;
  const first = url.pathname.split("/").filter(Boolean)[0];
  if (!first) return false;
  if (first.startsWith("@")) return false;
  let segment = first;
  try {
    segment = decodeURIComponent(first);
  } catch {
    // Malformed escapes: judge the raw segment.
  }
  return !RESERVED_SHORT_CODES.has(segment.toLowerCase());
}

const BLOCKLIST_TTL_MS = 60_000;
let blocklistCache: { domains: Set<string>; loadedAt: number } | null = null;

async function blockedDomains(): Promise<Set<string>> {
  if (blocklistCache && Date.now() - blocklistCache.loadedAt < BLOCKLIST_TTL_MS) {
    return blocklistCache.domains;
  }
  const rows = await prisma.blockedDomain.findMany({ select: { domain: true } });
  blocklistCache = { domains: new Set(rows.map((r) => r.domain)), loadedAt: Date.now() };
  return blocklistCache.domains;
}

export function clearBlocklistCache() {
  blocklistCache = null;
}

export async function isBlockedHost(host: string): Promise<boolean> {
  const blocked = await blockedDomains();
  return hostAndParents(host).some((candidate) => blocked.has(candidate));
}

/** Google Safe Browsing v4 lookup. Only runs when an API key is configured. */
async function safeBrowsingVerdict(url: string): Promise<string | null> {
  const key = config.safeBrowsingKey;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(3000),
        body: JSON.stringify({
          client: { clientId: "linkly", clientVersion: "2.0" },
          threatInfo: {
            threatTypes: [
              "MALWARE",
              "SOCIAL_ENGINEERING",
              "UNWANTED_SOFTWARE",
              "POTENTIALLY_HARMFUL_APPLICATION",
            ],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url }],
          },
        }),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { matches?: Array<{ threatType: string }> };
    return data.matches?.[0]?.threatType ?? null;
  } catch {
    // Fail open: a Safe Browsing outage must not block every link creation.
    return null;
  }
}

/**
 * Check a destination before it is saved. Covers the operator's allowlist,
 * self-referencing loops, the admin blocklist and, when configured, Google
 * Safe Browsing.
 */
export async function checkDestination(rawUrl: string): Promise<SafetyResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Please enter a valid URL" };
  }
  const host = hostOf(rawUrl);
  if (!host) return { ok: false, reason: "Please enter a valid URL" };

  const allowed = config.allowedDomains;
  if (allowed.length > 0 && !matchesDomainList(host, allowed)) {
    return {
      ok: false,
      reason: `This instance only shortens links to: ${allowed.join(", ")}`,
    };
  }

  if (isOwnShortLink(url)) {
    return { ok: false, reason: `Links to other ${config.siteName} short links are not allowed` };
  }

  if (await isBlockedHost(host)) {
    return { ok: false, reason: "This domain has been blocked for abuse" };
  }

  const threat = await safeBrowsingVerdict(rawUrl);
  if (threat) {
    return {
      ok: false,
      reason: `This URL was flagged as unsafe (${threat.toLowerCase().replace(/_/g, " ")})`,
    };
  }

  return { ok: true };
}

/** Check every URL a link can send visitors to. */
export async function checkLinkDestinations(
  urls: Array<string | null | undefined>,
): Promise<SafetyResult> {
  for (const url of new Set(urls.filter((u): u is string => !!u))) {
    const result = await checkDestination(url);
    if (!result.ok) return result;
  }
  return { ok: true };
}

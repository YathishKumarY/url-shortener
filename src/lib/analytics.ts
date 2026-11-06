import { cacheGet, cacheSet } from "@/lib/cache";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { isPrivateIp } from "@/lib/safe-fetch";
import type { VisitorInfo } from "@/lib/visitor";
import { dispatchWebhooks } from "@/lib/webhooks";

export { hashIp } from "@/lib/visitor";

interface Geo {
  country: string | null;
  region: string | null;
  city: string | null;
}

const NO_GEO: Geo = { country: null, region: null, city: null };

/**
 * Optional IP geolocation for hosts that do not send a country header
 * (anything but Vercel or Cloudflare). Off by default because it sends each
 * visitor's IP to a third party.
 *
 * Private and loopback addresses are never looked up: the old code asked the
 * provider about "the caller" for those, which geolocated the *server* and
 * attributed every local click to the data centre's city.
 */
async function lookupGeo(ip: string): Promise<Geo> {
  const provider = config.geolocationProvider;
  if (provider === "none" || !ip || ip === "anonymous" || isPrivateIp(ip)) return NO_GEO;

  const cacheKey = `geo:v1:${ip}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return (typeof cached === "string" ? JSON.parse(cached) : cached) as Geo;

  let geo = NO_GEO;
  try {
    if (provider === "ip-api") {
      // ip-api's free tier is HTTP-only; HTTPS needs a paid key.
      const res = await fetch(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode,regionName,city`,
        { signal: AbortSignal.timeout(2500) },
      );
      const data = await res.json();
      if (data.status === "success") {
        geo = {
          country: data.countryCode ?? null,
          region: data.regionName ?? null,
          city: data.city ?? null,
        };
      }
    } else if (provider === "ipinfo" && config.ipinfoToken) {
      const res = await fetch(
        `https://ipinfo.io/${encodeURIComponent(ip)}?token=${encodeURIComponent(config.ipinfoToken)}`,
        { signal: AbortSignal.timeout(2500) },
      );
      const data = await res.json();
      geo = { country: data.country ?? null, region: data.region ?? null, city: data.city ?? null };
    }
  } catch {
    return NO_GEO;
  }

  await cacheSet(cacheKey, JSON.stringify(geo), 86400);
  return geo;
}

export interface RecordClickInput {
  link: { id: string; userId: string | null; shortCode: string; domain: string; noLog?: boolean };
  visitor: VisitorInfo;
  source: "link" | "qr" | "bio";
  destination: string | null;
  /** The counter was already bumped atomically (click-limited links). */
  counted?: boolean;
}

/**
 * Store one visit. Bots get a row (so the dashboard can show bot traffic)
 * but never move the link's click counter.
 */
export async function recordClick({
  link,
  visitor,
  source,
  destination,
  counted = false,
}: RecordClickInput): Promise<void> {
  // Privacy mode: the counter moves (click limits still work) but nothing
  // about the visitor is written, and no click webhook carries their details.
  if (link.noLog) {
    if (!visitor.isBot && !counted) {
      await prisma.link.update({
        where: { id: link.id },
        data: { clickCount: { increment: 1 }, lastClickedAt: new Date() },
      });
    }
    return;
  }

  let geo: Geo = { country: visitor.country, region: visitor.region, city: visitor.city };
  if (!geo.country && !visitor.isBot) {
    const looked = await lookupGeo(visitor.ip);
    geo = {
      country: looked.country,
      region: geo.region ?? looked.region,
      city: geo.city ?? looked.city,
    };
  }

  const data = {
    linkId: link.id,
    referrer: visitor.referrer,
    referrerHost: visitor.referrerHost,
    browser: visitor.browser,
    os: visitor.os,
    device: visitor.device,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    language: visitor.language,
    source,
    destination,
    isBot: visitor.isBot,
    ipHash: visitor.ipHash,
  };

  if (visitor.isBot || counted) {
    await prisma.click.create({ data });
  } else {
    // One transaction so a click is never counted without its detail row, and
    // a detail row never lands without the counter moving.
    await prisma.$transaction([
      prisma.click.create({ data }),
      prisma.link.update({
        where: { id: link.id },
        data: { clickCount: { increment: 1 }, lastClickedAt: new Date() },
      }),
    ]);
  }

  if (!visitor.isBot) {
    await dispatchWebhooks(link.userId, "link.clicked", {
      link: { id: link.id, shortCode: link.shortCode, domain: link.domain || null },
      click: {
        timestamp: new Date().toISOString(),
        source,
        destination,
        country: geo.country,
        city: geo.city,
        device: visitor.device,
        browser: visitor.browser,
        os: visitor.os,
        referrer: visitor.referrerHost,
        language: visitor.language,
      },
    });
  }
}

/**
 * Atomically claim one click on a click-limited link. Returns false once the
 * limit is reached. A single conditional UPDATE means two simultaneous
 * visitors to a one-time link cannot both get through.
 */
export async function claimLimitedClick(linkId: string, maxClicks: number): Promise<boolean> {
  const claimed = await prisma.link.updateMany({
    where: { id: linkId, clickCount: { lt: maxClicks } },
    data: { clickCount: { increment: 1 }, lastClickedAt: new Date() },
  });
  return claimed.count > 0;
}

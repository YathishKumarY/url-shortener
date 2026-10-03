import { createHash } from "crypto";
import { UAParser } from "ua-parser-js";
import { prisma } from "@/lib/prisma";

interface ClickData {
  linkId: string;
  request: Request;
  geo?: { country?: string; city?: string };
}

/**
 * An unsalted SHA-256 of an IP is not anonymous: the whole IPv4 space is only
 * ~4.3 billion inputs, so any hash can be reversed by brute force in minutes.
 * A secret salt makes the digest useless without the key while still being
 * stable enough to count unique visitors.
 */
const IP_HASH_SALT = process.env.IP_HASH_SALT ?? "";

if (!IP_HASH_SALT && process.env.NODE_ENV === "production") {
  console.warn(
    "[analytics] IP_HASH_SALT is not set - visitor hashes are brute-forceable. Set it in the environment.",
  );
}

function hashIp(ip: string): string {
  return createHash("sha256").update(`${IP_HASH_SALT}:${ip}`).digest("hex").slice(0, 32);
}

function isPrivateAddress(ip: string): boolean {
  return (
    !ip ||
    ip === "unknown" ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

async function geolocateIp(ip: string): Promise<{ country: string | null; city: string | null }> {
  try {
    // HTTPS so the visitor's IP is not sent to a third party in cleartext.
    const url = isPrivateAddress(ip)
      ? "https://ip-api.com/json/?fields=status,country,city"
      : `https://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,city`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { country: null, city: null };
    const data = await res.json();
    if (data.status !== "success") return { country: null, city: null };
    return { country: data.country ?? null, city: data.city ?? null };
  } catch {
    return { country: null, city: null };
  }
}

export async function recordClick({ linkId, request, geo }: ClickData) {
  const ua = new UAParser(request.headers.get("user-agent") ?? "");
  const referrer = request.headers.get("referer") ?? null;
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";

  const browser = ua.getBrowser().name ?? null;
  const os = ua.getOS().name ?? null;
  const deviceType = ua.getDevice().type ?? "desktop";

  let country = geo?.country ?? request.headers.get("x-vercel-ip-country") ?? null;
  let city = geo?.city ?? request.headers.get("x-vercel-ip-city") ?? null;

  if (!country) {
    const geoData = await geolocateIp(ip);
    country = geoData.country;
    city = city ?? geoData.city;
  }

  // One transaction so a click is never counted without its detail row, and a
  // detail row never lands without the counter moving. Previously these ran as
  // independent promises: if the counter update failed the click was recorded
  // but invisible in the dashboard total, and vice versa.
  await prisma.$transaction([
    prisma.click.create({
      data: {
        linkId,
        referrer,
        browser,
        os,
        device: deviceType,
        country,
        city,
        ipHash: ip !== "unknown" ? hashIp(ip) : null,
      },
    }),
    prisma.link.update({
      where: { id: linkId },
      data: { clickCount: { increment: 1 } },
    }),
  ]);
}

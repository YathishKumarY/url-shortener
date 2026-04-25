import { createHash } from "crypto";
import { UAParser } from "ua-parser-js";
import { prisma } from "@/lib/prisma";

interface ClickData {
  linkId: string;
  request: Request;
  geo?: { country?: string; city?: string };
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

async function geolocateIp(ip: string): Promise<{ country: string | null; city: string | null }> {
  try {
    const isLocal =
      !ip ||
      ip === "unknown" ||
      ip === "127.0.0.1" ||
      ip === "::1" ||
      ip.startsWith("192.168.") ||
      ip.startsWith("10.");
    const url = isLocal
      ? "http://ip-api.com/json/?fields=status,country,city"
      : `http://ip-api.com/json/${ip}?fields=status,country,city`;
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

  await Promise.all([
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

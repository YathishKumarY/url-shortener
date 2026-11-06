import { createHash } from "crypto";
import { UAParser } from "ua-parser-js";
import { isBot as detectBot } from "ua-parser-js/bot-detection";
import { getClientIp } from "@/lib/rate-limit";

export type DeviceOs = "ios" | "android" | "other";

export interface VisitorInfo {
  ip: string;
  ipHash: string | null;
  userAgent: string;
  browser: string | null;
  os: string | null;
  /** For targeting: which mobile platform, if any. */
  platform: DeviceOs;
  device: string;
  isBot: boolean;
  /**
   * A link-unfurling crawler (Slack, X, WhatsApp, Discord...). These fetch the
   * short URL to build a preview card, so they get the custom social preview
   * and never consume a click-limited link.
   */
  isPreviewBot: boolean;
  country: string | null;
  region: string | null;
  city: string | null;
  language: string | null;
  referrer: string | null;
  referrerHost: string | null;
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

export function hashIp(ip: string): string {
  return createHash("sha256").update(`${IP_HASH_SALT}:${ip}`).digest("hex").slice(0, 32);
}

/*
 * Only the unfurlers themselves. In-app browsers (LINE, KakaoTalk, Snapchat,
 * Teams...) also put the app name in their UA, but those are humans tapping
 * the link, so their crawlers are matched by their specific bot names.
 */
const PREVIEW_BOT =
  /facebookexternalhit|facebot|twitterbot|slackbot|linkedinbot|discordbot|telegrambot|whatsapp\/|pinterestbot|redditbot|applebot|embedly|skypeuripreview|iframely|vkshare|mastodon\/|cardyb|snap url preview|kakaotalk-scrap|google-pagerenderer|quora link preview|bitlybot|bingpreview|microsoftpreview|xing-contenttabreceiver/i;

export function isPreviewBotUserAgent(ua: string): boolean {
  return PREVIEW_BOT.test(ua);
}

/** Platform from the user agent, for iOS/Android targeting. */
export function detectPlatform(ua: string): DeviceOs {
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "other";
}

function header(request: Request, ...names: string[]): string | null {
  for (const name of names) {
    const value = request.headers.get(name)?.trim();
    if (value) return value;
  }
  return null;
}

function safeDecode(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Country from platform headers: Vercel, Cloudflare, or a generic header a
 * reverse proxy can set. "XX" (unknown) and "T1" (Tor) are not countries.
 */
export function countryFromHeaders(request: Request): string | null {
  const raw = header(
    request,
    "x-vercel-ip-country",
    "cf-ipcountry",
    "x-country-code",
    "x-geo-country",
  );
  if (!raw) return null;
  const code = raw.toUpperCase();
  return /^[A-Z]{2}$/.test(code) && code !== "XX" && code !== "T1" ? code : null;
}

/** Primary language tag from Accept-Language, e.g. "en-US". */
export function parseLanguage(acceptLanguage: string | null): string | null {
  if (!acceptLanguage) return null;
  const first = acceptLanguage.split(",")[0]?.split(";")[0]?.trim();
  if (!first || first === "*" || !/^[a-zA-Z]{1,8}(-[a-zA-Z0-9]{1,8})*$/.test(first)) return null;
  // BCP 47 casing: language lower, script Title, region upper ("zh-Hant-TW").
  return first
    .split("-")
    .slice(0, 3)
    .map((part, index) => {
      if (index === 0) return part.toLowerCase();
      if (part.length === 4 && /^[a-z]+$/i.test(part))
        return part[0].toUpperCase() + part.slice(1).toLowerCase();
      if (part.length === 2 || /^\d{3}$/.test(part)) return part.toUpperCase();
      return part.toLowerCase();
    })
    .join("-");
}

export function referrerHostOf(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

export function parseVisitor(request: Request): VisitorInfo {
  const userAgent = request.headers.get("user-agent") ?? "";
  const ua = new UAParser(userAgent).getResult();
  const isBot = !userAgent || detectBot(userAgent);
  const ip = getClientIp(request);
  const referrer = request.headers.get("referer");

  return {
    ip,
    ipHash: ip !== "anonymous" && ip !== "unknown" ? hashIp(ip) : null,
    userAgent,
    browser: ua.browser.name ?? null,
    os: ua.os.name ?? null,
    platform: detectPlatform(userAgent),
    device: isBot ? "bot" : (ua.device.type ?? "desktop"),
    isBot,
    isPreviewBot: isPreviewBotUserAgent(userAgent),
    country: countryFromHeaders(request),
    region: header(request, "x-vercel-ip-country-region", "cf-region-code", "x-geo-region"),
    city: safeDecode(header(request, "x-vercel-ip-city", "cf-ipcity", "x-geo-city")),
    language: parseLanguage(request.headers.get("accept-language")),
    referrer: referrer ? referrer.slice(0, 2048) : null,
    referrerHost: referrerHostOf(referrer),
  };
}

import { createHash } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  countryFromHeaders,
  detectPlatform,
  hashIp,
  isPreviewBotUserAgent,
  parseLanguage,
  parseVisitor,
  referrerHostOf,
} from "@/lib/visitor";

// rate-limit (for getClientIp) builds limiters on import; keep them in memory.
vi.mock("@/lib/redis", () => ({ redis: null }));

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  ipadSafari:
    "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  ipod: "Mozilla/5.0 (iPod touch; CPU iPhone OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  desktopChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  slackbot: "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
  facebook: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  whatsapp: "WhatsApp/2.23.20.0 A",
  discord: "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
  twitter: "Twitterbot/1.0",
  linkedin: "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
  telegram: "TelegramBot (like TwitterBot)",
  teamsPreview:
    "Mozilla/5.0 (Windows NT 6.1; WOW64) SkypeUriPreview Preview/0.5 skype-url-preview@microsoft.com",
  kakaoScraper: "facebookexternalhit/1.1; kakaotalk-scrap/1.0; +https://devtalk.kakao.com/",
  lineInApp:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.3.0",
  kakaoInApp:
    "Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36;KAKAOTALK 2410150",
  teamsInApp:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Teams/24004.1307.2669.7070",
  instagramInApp:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0.0 (iPhone15,2; iOS 17_4; en_US; en; scale=3.00)",
  facebookInApp:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0.0.0.0;FBDV/iPhone15,2;FBSN/iOS;FBSV/17.4]",
};

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://lnk.example/abc1234", { headers });
}

describe("parseLanguage", () => {
  it.each([
    ["en-US,en;q=0.9", "en-US"],
    ["fr-CH, fr;q=0.9, en;q=0.8", "fr-CH"],
    ["de", "de"],
    ["EN-gb", "en-GB"],
    ["pt-br;q=0.8", "pt-BR"],
    [" es-419 , en", "es-419"],
  ])("reads the primary tag of %o as %s", (header, expected) => {
    expect(parseLanguage(header)).toBe(expected);
  });

  it.each([null, "", "*", "*;q=0.5", ";q=0.9", "en_US", "123", "en-", "toolonglanguage"])(
    "returns null for %o",
    (header) => {
      expect(parseLanguage(header)).toBeNull();
    },
  );
});

describe("countryFromHeaders", () => {
  it("reads Vercel's country header", () => {
    expect(countryFromHeaders(request({ "x-vercel-ip-country": "US" }))).toBe("US");
  });

  it.each([
    ["cf-ipcountry", "gb", "GB"],
    ["x-country-code", "in", "IN"],
    ["x-geo-country", "de", "DE"],
  ])("normalises %s %o to upper case", (name, value, expected) => {
    expect(countryFromHeaders(request({ [name]: value }))).toBe(expected);
  });

  it("prefers Vercel, then Cloudflare, then the generic proxy headers", () => {
    const vercel = { "x-vercel-ip-country": "US" };
    const cloudflare = { "cf-ipcountry": "GB" };
    const proxy = { "x-country-code": "IN" };
    const geo = { "x-geo-country": "DE" };
    expect(countryFromHeaders(request({ ...geo, ...proxy, ...cloudflare, ...vercel }))).toBe("US");
    expect(countryFromHeaders(request({ ...geo, ...proxy, ...cloudflare }))).toBe("GB");
    expect(countryFromHeaders(request({ ...geo, ...proxy }))).toBe("IN");
    expect(countryFromHeaders(request(geo))).toBe("DE");
  });

  it("skips a blank header in favour of the next one", () => {
    expect(countryFromHeaders(request({ "x-vercel-ip-country": "  ", "cf-ipcountry": "FR" }))).toBe(
      "FR",
    );
  });

  it.each(["XX", "xx", "T1", "t1"])("ignores the non-country code %s", (value) => {
    expect(countryFromHeaders(request({ "cf-ipcountry": value }))).toBeNull();
  });

  it.each(["USA", "U", "1A", "U$"])("ignores the malformed code %s", (value) => {
    expect(countryFromHeaders(request({ "x-vercel-ip-country": value }))).toBeNull();
  });

  it("returns null without any geo header", () => {
    expect(countryFromHeaders(request())).toBeNull();
  });
});

describe("detectPlatform", () => {
  it.each([
    [UA.iphoneSafari, "ios"],
    [UA.ipadSafari, "ios"],
    [UA.ipod, "ios"],
    ["SOMEAPP (IPHONE)", "ios"],
    [UA.androidChrome, "android"],
    [UA.kakaoInApp, "android"],
    [UA.desktopChrome, "other"],
    [UA.macSafari, "other"],
    ["", "other"],
  ])("classifies %s as %s", (ua, expected) => {
    expect(detectPlatform(ua)).toBe(expected);
  });
});

describe("isPreviewBotUserAgent", () => {
  it.each([
    UA.slackbot,
    UA.facebook,
    UA.whatsapp,
    UA.discord,
    UA.twitter,
    UA.linkedin,
    UA.telegram,
    UA.teamsPreview,
    UA.kakaoScraper,
  ])("recognises the unfurler %s", (ua) => {
    expect(isPreviewBotUserAgent(ua)).toBe(true);
  });

  /* In-app browsers name their app in the UA, but a human tapped the link. */
  it.each([
    UA.lineInApp,
    UA.kakaoInApp,
    UA.teamsInApp,
    UA.instagramInApp,
    UA.facebookInApp,
    UA.desktopChrome,
    UA.macSafari,
    UA.iphoneSafari,
    UA.androidChrome,
    UA.googlebot,
    "",
  ])("does not treat %o as a preview bot", (ua) => {
    expect(isPreviewBotUserAgent(ua)).toBe(false);
  });
});

describe("referrerHostOf", () => {
  it.each([
    ["https://www.google.com/search?q=x", "google.com"],
    ["https://news.ycombinator.com/item?id=1", "news.ycombinator.com"],
    ["https://WWW.Example.COM/", "example.com"],
    ["http://www2.example.com/", "www2.example.com"],
    ["android-app://com.google.android.gm/", "com.google.android.gm"],
  ])("extracts the host of %s", (referrer, expected) => {
    expect(referrerHostOf(referrer)).toBe(expected);
  });

  it.each([null, "", "not a url", "/relative/path", "about:blank"])(
    "returns null for %o",
    (referrer) => {
      expect(referrerHostOf(referrer)).toBeNull();
    },
  );
});

describe("hashIp", () => {
  it("is a stable 32-character hex digest", () => {
    expect(hashIp("203.0.113.7")).toMatch(/^[0-9a-f]{32}$/);
    expect(hashIp("203.0.113.7")).toBe(hashIp("203.0.113.7"));
  });

  it("differs between addresses", () => {
    expect(hashIp("203.0.113.7")).not.toBe(hashIp("203.0.113.8"));
  });
});

describe("parseVisitor", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("extracts every field from a mobile visit", () => {
    const visitor = parseVisitor(
      request({
        "user-agent": UA.iphoneSafari,
        "x-real-ip": "203.0.113.7",
        "x-vercel-ip-country": "in",
        "x-vercel-ip-country-region": "MH",
        "x-vercel-ip-city": "Navi%20Mumbai",
        "accept-language": "en-IN,en;q=0.9",
        referer: "https://www.google.com/",
      }),
    );

    expect(visitor).toEqual({
      ip: "203.0.113.7",
      ipHash: hashIp("203.0.113.7"),
      userAgent: UA.iphoneSafari,
      browser: "Mobile Safari",
      os: "iOS",
      platform: "ios",
      device: "mobile",
      isBot: false,
      isPreviewBot: false,
      country: "IN",
      region: "MH",
      city: "Navi Mumbai",
      language: "en-IN",
      referrer: "https://www.google.com/",
      referrerHost: "google.com",
    });
  });

  it("reports a desktop browser with no device type as desktop", () => {
    const visitor = parseVisitor(request({ "user-agent": UA.desktopChrome }));
    expect(visitor).toMatchObject({
      browser: "Chrome",
      os: "Windows",
      platform: "other",
      device: "desktop",
      isBot: false,
    });
  });

  it("reports tablets", () => {
    expect(parseVisitor(request({ "user-agent": UA.ipadSafari })).device).toBe("tablet");
  });

  it("marks crawlers as bots", () => {
    const visitor = parseVisitor(request({ "user-agent": UA.googlebot }));
    expect(visitor.isBot).toBe(true);
    expect(visitor.device).toBe("bot");
    expect(visitor.isPreviewBot).toBe(false);
  });

  it("marks link unfurlers as both bots and preview bots", () => {
    const visitor = parseVisitor(request({ "user-agent": UA.slackbot }));
    expect(visitor).toMatchObject({ isBot: true, isPreviewBot: true, device: "bot" });
  });

  it("treats a missing user agent as a bot", () => {
    const visitor = parseVisitor(request());
    expect(visitor).toMatchObject({
      userAgent: "",
      isBot: true,
      device: "bot",
      browser: null,
      os: null,
      platform: "other",
    });
  });

  it("URI-decodes the Vercel city header", () => {
    expect(parseVisitor(request({ "x-vercel-ip-city": "S%C3%A3o%20Paulo" })).city).toBe(
      "São Paulo",
    );
  });

  it("keeps a malformed city header as-is instead of throwing", () => {
    expect(parseVisitor(request({ "x-vercel-ip-city": "%E0%A4%A" })).city).toBe("%E0%A4%A");
  });

  it("falls back to Cloudflare's region and city headers", () => {
    const visitor = parseVisitor(request({ "cf-region-code": "CA", "cf-ipcity": "San%20Jose" }));
    expect(visitor.region).toBe("CA");
    expect(visitor.city).toBe("San Jose");
  });

  it("has no IP hash when the caller cannot be identified", () => {
    const visitor = parseVisitor(request({ "user-agent": UA.desktopChrome }));
    expect(visitor.ip).toBe("anonymous");
    expect(visitor.ipHash).toBeNull();
  });

  it("hashes the trusted forwarded address", () => {
    vi.stubEnv("TRUSTED_PROXY_COUNT", undefined);
    const visitor = parseVisitor(request({ "x-forwarded-for": "1.2.3.4, 198.51.100.20" }));
    expect(visitor.ip).toBe("198.51.100.20");
    expect(visitor.ipHash).toBe(hashIp("198.51.100.20"));
  });

  it("truncates a huge referrer but still reads its host", () => {
    const visitor = parseVisitor(request({ referer: `https://example.com/${"a".repeat(5000)}` }));
    expect(visitor.referrer).toHaveLength(2048);
    expect(visitor.referrerHost).toBe("example.com");
  });

  it("leaves optional fields null when headers are absent", () => {
    expect(parseVisitor(request({ "user-agent": UA.desktopChrome }))).toMatchObject({
      country: null,
      region: null,
      city: null,
      language: null,
      referrer: null,
      referrerHost: null,
    });
  });
});

describe("IP hash salt", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.doUnmock("@/lib/rate-limit");
    vi.resetModules();
  });

  async function freshVisitorModule() {
    vi.resetModules();
    vi.doMock("@/lib/rate-limit", () => ({ getClientIp: () => "anonymous" }));
    return import("@/lib/visitor");
  }

  it("mixes IP_HASH_SALT into the digest", async () => {
    vi.stubEnv("IP_HASH_SALT", "pepper");
    const { hashIp: salted } = await freshVisitorModule();
    const expected = createHash("sha256").update("pepper:198.51.100.4").digest("hex").slice(0, 32);
    expect(salted("198.51.100.4")).toBe(expected);
  });

  it("produces different digests for different salts", async () => {
    vi.stubEnv("IP_HASH_SALT", "one");
    const first = (await freshVisitorModule()).hashIp("198.51.100.4");
    vi.stubEnv("IP_HASH_SALT", "two");
    const second = (await freshVisitorModule()).hashIp("198.51.100.4");
    expect(first).not.toBe(second);
  });

  it("warns at startup in production when no salt is set", async () => {
    vi.stubEnv("IP_HASH_SALT", "");
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await freshVisitorModule();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("IP_HASH_SALT"));
  });

  it("stays quiet in production when a salt is set", async () => {
    vi.stubEnv("IP_HASH_SALT", "pepper");
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await freshVisitorModule();
    expect(warn).not.toHaveBeenCalled();
  });
});

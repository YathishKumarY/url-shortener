import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkDestination,
  checkLinkDestinations,
  clearBlocklistCache,
  hostAndParents,
  isBlockedHost,
  matchesDomainList,
} from "@/lib/safety";

const findMany = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { blockedDomain: { findMany } } }));

const fetchMock = vi.fn<typeof fetch>();

function blocklist(...domains: string[]) {
  findMany.mockResolvedValue(domains.map((domain) => ({ domain })));
}

beforeEach(() => {
  findMany.mockReset();
  blocklist();
  clearBlocklistCache();
  vi.stubEnv("ALLOWED_DOMAINS", undefined);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://lnk.example");
  vi.stubEnv("AUTH_URL", undefined);
  vi.stubEnv("NEXTAUTH_URL", undefined);
  vi.stubEnv("NEXT_PUBLIC_SITE_NAME", undefined);
  vi.stubEnv("GOOGLE_SAFE_BROWSING_API_KEY", undefined);
  // Safe Browsing must never reach the network from a test.
  fetchMock.mockReset();
  fetchMock.mockRejectedValue(new Error("network disabled in tests"));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("hostAndParents", () => {
  it.each([
    ["a.b.example.com", ["a.b.example.com", "b.example.com", "example.com"]],
    ["example.com", ["example.com"]],
    ["example.co.uk", ["example.co.uk", "co.uk"]],
    ["localhost", []],
  ])("expands %s", (host, expected) => {
    expect(hostAndParents(host)).toEqual(expected);
  });
});

describe("matchesDomainList", () => {
  const list = ["example.com", "wikipedia.org"];

  it.each(["example.com", "www.example.com", "a.b.example.com", "en.wikipedia.org"])(
    "matches %s",
    (host) => {
      expect(matchesDomainList(host, list)).toBe(true);
    },
  );

  it.each(["notexample.com", "example.com.evil.net", "example.co", "wikipedia.org.evil.com"])(
    "does not match %s",
    (host) => {
      expect(matchesDomainList(host, list)).toBe(false);
    },
  );

  it("matches nothing against an empty list", () => {
    expect(matchesDomainList("example.com", [])).toBe(false);
  });
});

describe("isBlockedHost", () => {
  it("blocks a host whose parent domain is listed", async () => {
    blocklist("b.evil.com");
    await expect(isBlockedHost("a.b.evil.com")).resolves.toBe(true);
    await expect(isBlockedHost("evil.com")).resolves.toBe(false);
  });
});

describe("checkDestination", () => {
  it("accepts an ordinary destination", async () => {
    await expect(checkDestination("https://example.com/page")).resolves.toEqual({ ok: true });
  });

  it.each(["not a url", "", "example.com"])("rejects the unparseable URL %o", async (url) => {
    await expect(checkDestination(url)).resolves.toEqual({
      ok: false,
      reason: "Please enter a valid URL",
    });
  });

  describe("allowlist", () => {
    beforeEach(() => {
      vi.stubEnv("ALLOWED_DOMAINS", "wikipedia.org, Wikimedia.org");
    });

    it.each([
      "https://en.wikipedia.org/wiki/URL_shortening",
      "https://wikimedia.org/",
      "https://WIKIPEDIA.ORG/",
    ])("allows %s", async (url) => {
      await expect(checkDestination(url)).resolves.toEqual({ ok: true });
    });

    it.each([
      "https://example.com/",
      "https://wikipedia.org.evil.com/",
      "https://notwikipedia.org/",
    ])("rejects %s before touching the blocklist", async (url) => {
      await expect(checkDestination(url)).resolves.toEqual({
        ok: false,
        reason: "This instance only shortens links to: wikipedia.org, wikimedia.org",
      });
      expect(findMany).not.toHaveBeenCalled();
    });
  });

  describe("links to our own short URLs", () => {
    it.each([
      "https://lnk.example/abc123",
      "https://LNK.EXAMPLE/abc123",
      "https://lnk.example:8443/abc123",
      "https://lnk.example/%F0%9F%9A%80",
      "https://lnk.example/%E0%A4%A",
      "http://lnk.example/abc123/extra?x=1",
    ])("rejects %s as a redirect chain", async (url) => {
      await expect(checkDestination(url)).resolves.toEqual({
        ok: false,
        reason: "Links to other Linkly short links are not allowed",
      });
      expect(findMany).not.toHaveBeenCalled();
    });

    it.each([
      "https://lnk.example/",
      "https://lnk.example/@alice",
      "https://lnk.example/docs/api",
      "https://lnk.example/DASHBOARD",
      "https://lnk.example/%64ocs",
      "https://sub.lnk.example/abc123",
    ])("allows the app page or other host %s", async (url) => {
      await expect(checkDestination(url)).resolves.toEqual({ ok: true });
    });

    it("names the configured site", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_NAME", "Shorty");
      await expect(checkDestination("https://lnk.example/abc123")).resolves.toEqual({
        ok: false,
        reason: "Links to other Shorty short links are not allowed",
      });
    });

    it("ignores the port of the configured app URL", async () => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
      await expect(checkDestination("http://localhost:3000/xyz")).resolves.toMatchObject({
        ok: false,
      });
      await expect(checkDestination("http://localhost:4000/xyz")).resolves.toMatchObject({
        ok: false,
      });
    });
  });

  describe("blocklist", () => {
    beforeEach(() => {
      blocklist("evil.com");
    });

    it.each(["https://evil.com/x", "https://login.evil.com/x", "https://EVIL.com./x"])(
      "rejects %s",
      async (url) => {
        await expect(checkDestination(url)).resolves.toEqual({
          ok: false,
          reason: "This domain has been blocked for abuse",
        });
      },
    );

    it.each(["https://notevil.com/", "https://evil.com.au/", "https://evil.co/"])(
      "allows %s",
      async (url) => {
        await expect(checkDestination(url)).resolves.toEqual({ ok: true });
      },
    );

    it("caches the blocklist for a minute", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-06T12:00:00Z"));
      await checkDestination("https://a.com/");
      await checkDestination("https://b.com/");
      expect(findMany).toHaveBeenCalledTimes(1);

      vi.setSystemTime(new Date("2026-11-06T12:00:59.999Z"));
      await checkDestination("https://c.com/");
      expect(findMany).toHaveBeenCalledTimes(1);

      vi.setSystemTime(new Date("2026-11-06T12:01:00Z"));
      await checkDestination("https://d.com/");
      expect(findMany).toHaveBeenCalledTimes(2);
    });

    it("reloads after clearBlocklistCache", async () => {
      await checkDestination("https://a.com/");
      blocklist("a.com");
      await expect(checkDestination("https://a.com/")).resolves.toEqual({ ok: true });
      clearBlocklistCache();
      await expect(checkDestination("https://a.com/")).resolves.toMatchObject({ ok: false });
    });
  });

  describe("Google Safe Browsing", () => {
    beforeEach(() => {
      vi.stubEnv("GOOGLE_SAFE_BROWSING_API_KEY", "test-key");
    });

    it("is skipped without an API key", async () => {
      vi.stubEnv("GOOGLE_SAFE_BROWSING_API_KEY", undefined);
      await expect(checkDestination("https://example.com/")).resolves.toEqual({ ok: true });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects a flagged URL with a readable threat name", async () => {
      fetchMock.mockResolvedValue(
        Response.json({ matches: [{ threatType: "SOCIAL_ENGINEERING" }] }),
      );
      await expect(checkDestination("https://phish.example/login")).resolves.toEqual({
        ok: false,
        reason: "This URL was flagged as unsafe (social engineering)",
      });
      const [endpoint, init] = fetchMock.mock.calls[0];
      expect(String(endpoint)).toBe(
        "https://safebrowsing.googleapis.com/v4/threatMatches:find?key=test-key",
      );
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body)).threatInfo.threatEntries).toEqual([
        { url: "https://phish.example/login" },
      ]);
    });

    it("accepts a URL with no matches", async () => {
      fetchMock.mockResolvedValue(Response.json({}));
      await expect(checkDestination("https://example.com/")).resolves.toEqual({ ok: true });
    });

    it("fails open when the API errors or is unreachable", async () => {
      fetchMock.mockResolvedValueOnce(new Response("quota", { status: 429 }));
      await expect(checkDestination("https://example.com/a")).resolves.toEqual({ ok: true });
      fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
      await expect(checkDestination("https://example.com/b")).resolves.toEqual({ ok: true });
    });

    it("is not consulted for a blocked domain", async () => {
      blocklist("evil.com");
      await expect(checkDestination("https://evil.com/")).resolves.toMatchObject({ ok: false });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

describe("checkLinkDestinations", () => {
  it("accepts an empty list and skips blank entries", async () => {
    await expect(checkLinkDestinations([])).resolves.toEqual({ ok: true });
    await expect(checkLinkDestinations([null, undefined, ""])).resolves.toEqual({ ok: true });
  });

  it("returns the first failure in order", async () => {
    blocklist("evil.com");
    await expect(
      checkLinkDestinations([
        "https://ok.example/",
        "https://evil.com/x",
        "https://lnk.example/abc123",
      ]),
    ).resolves.toEqual({ ok: false, reason: "This domain has been blocked for abuse" });
  });

  it("checks each distinct URL once", async () => {
    vi.stubEnv("GOOGLE_SAFE_BROWSING_API_KEY", "test-key");
    fetchMock.mockImplementation(async () => Response.json({}));
    await expect(
      checkLinkDestinations([
        "https://a.example/",
        null,
        "https://a.example/",
        "https://b.example/",
      ]),
    ).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

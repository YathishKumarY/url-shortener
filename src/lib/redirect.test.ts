import { afterEach, describe, expect, it, vi } from "vitest";
import type { Link } from "@/generated/prisma/client";
import {
  INTERNAL_PARAMS,
  evaluateGates,
  forwardQueryParams,
  parseCachedRedirectLink,
  parseGeoTargets,
  parseVariants,
  pickDestination,
  shouldServePreviewCard,
  toRedirectLink,
  visitSource,
  weightedPick,
  type RedirectLink,
} from "@/lib/redirect";

const NOW = Date.UTC(2026, 10, 6, 12, 0, 0);

function makeLink(overrides: Partial<RedirectLink> = {}): RedirectLink {
  return {
    v: 2,
    id: "link_1",
    userId: "user_1",
    domain: "",
    shortCode: "abc1234",
    url: "https://example.com/landing",
    title: null,
    expiresAt: null,
    startsAt: null,
    maxClicks: null,
    disabled: false,
    banned: false,
    hasPassword: false,
    expiredUrl: null,
    redirectType: 302,
    forwardQuery: true,
    hideReferrer: false,
    cloaked: false,
    noLog: false,
    iosUrl: null,
    androidUrl: null,
    geoTargets: null,
    abVariants: null,
    ogTitle: null,
    ogDescription: null,
    ogImage: null,
    ...overrides,
  };
}

/** A database row as Prisma returns it. Cast so new schema columns do not break the test. */
function makeRow(overrides: Partial<Link> = {}): Link {
  return {
    id: "link_1",
    domain: "",
    shortCode: "abc1234",
    originalUrl: "https://example.com/landing",
    customAlias: null,
    userId: "user_1",
    title: "Landing",
    description: "private notes",
    password: null,
    expiresAt: null,
    expiredUrl: null,
    startsAt: null,
    maxClicks: null,
    disabled: false,
    archived: false,
    redirectType: 302,
    forwardQuery: true,
    hideReferrer: false,
    cloaked: false,
    iosUrl: null,
    androidUrl: null,
    geoTargets: null,
    abVariants: null,
    ogTitle: null,
    ogDescription: null,
    ogImage: null,
    publicStats: false,
    bioPinned: false,
    bioPosition: 0,
    bannedAt: null,
    bannedReason: null,
    clickCount: 0,
    lastClickedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as Link;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("evaluateGates", () => {
  it("lets an ordinary link through", () => {
    expect(evaluateGates(makeLink(), NOW)).toEqual({ kind: "ok" });
  });

  it("puts a ban ahead of every other rule", () => {
    const link = makeLink({
      banned: true,
      disabled: true,
      startsAt: NOW + 60_000,
      expiresAt: NOW - 60_000,
    });
    expect(evaluateGates(link, NOW)).toEqual({ kind: "banned" });
  });

  it("puts disabled ahead of scheduled and expired", () => {
    const link = makeLink({ disabled: true, startsAt: NOW + 60_000, expiresAt: NOW - 60_000 });
    expect(evaluateGates(link, NOW)).toEqual({ kind: "disabled" });
  });

  it("puts scheduled ahead of expired", () => {
    const link = makeLink({ startsAt: NOW + 60_000, expiresAt: NOW - 60_000 });
    expect(evaluateGates(link, NOW)).toEqual({ kind: "scheduled", startsAt: NOW + 60_000 });
  });

  it("reports expiry with the owner's fallback URL", () => {
    const link = makeLink({ expiresAt: NOW - 1, expiredUrl: "https://example.com/sorry" });
    expect(evaluateGates(link, NOW)).toEqual({
      kind: "expired",
      reason: "expired",
      fallback: "https://example.com/sorry",
    });
  });

  it("reports a null fallback when none is configured", () => {
    expect(evaluateGates(makeLink({ expiresAt: NOW - 1 }), NOW)).toEqual({
      kind: "expired",
      reason: "expired",
      fallback: null,
    });
  });

  it("treats the exact expiry instant as expired", () => {
    expect(evaluateGates(makeLink({ expiresAt: NOW }), NOW).kind).toBe("expired");
    expect(evaluateGates(makeLink({ expiresAt: NOW + 1 }), NOW).kind).toBe("ok");
  });

  it("treats the exact start instant as live", () => {
    expect(evaluateGates(makeLink({ startsAt: NOW }), NOW).kind).toBe("ok");
    expect(evaluateGates(makeLink({ startsAt: NOW + 1 }), NOW).kind).toBe("scheduled");
  });

  it("allows a link inside its start/expiry window", () => {
    const link = makeLink({ startsAt: NOW - 1000, expiresAt: NOW + 1000 });
    expect(evaluateGates(link, NOW)).toEqual({ kind: "ok" });
  });

  it("uses the current time when none is passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(evaluateGates(makeLink({ expiresAt: NOW - 1 })).kind).toBe("expired");
    expect(evaluateGates(makeLink({ expiresAt: NOW + 1 })).kind).toBe("ok");
  });
});

describe("pickDestination", () => {
  const targeted = makeLink({
    iosUrl: "https://apps.apple.com/app/id1",
    androidUrl: "https://play.google.com/store/apps/details?id=x",
    geoTargets: { IN: "https://example.in/", DE: "https://example.de/" },
    abVariants: [
      { url: "https://example.com/a", weight: 50 },
      { url: "https://example.com/b", weight: 50 },
    ],
  });

  it("serves the default URL with no targeting configured", () => {
    expect(pickDestination(makeLink(), { platform: "other", country: "US" })).toEqual({
      url: "https://example.com/landing",
      variant: null,
      reason: "default",
    });
  });

  it("sends iOS visitors to the iOS URL even inside geo and A/B targeting", () => {
    expect(pickDestination(targeted, { platform: "ios", country: "IN", random: () => 0 })).toEqual({
      url: "https://apps.apple.com/app/id1",
      variant: null,
      reason: "ios",
    });
  });

  it("sends Android visitors to the Android URL even inside geo and A/B targeting", () => {
    expect(
      pickDestination(targeted, { platform: "android", country: "IN", random: () => 0 }),
    ).toEqual({
      url: "https://play.google.com/store/apps/details?id=x",
      variant: null,
      reason: "android",
    });
  });

  it("never serves the iOS URL to Android or desktop visitors", () => {
    const iosOnly = makeLink({ iosUrl: "https://apps.apple.com/app/id1" });
    expect(pickDestination(iosOnly, { platform: "android", country: null }).reason).toBe("default");
    expect(pickDestination(iosOnly, { platform: "other", country: null }).reason).toBe("default");
  });

  it("falls through to geo targeting when the platform URL is missing", () => {
    const link = makeLink({ geoTargets: { IN: "https://example.in/" } });
    expect(pickDestination(link, { platform: "ios", country: "IN" })).toEqual({
      url: "https://example.in/",
      variant: null,
      reason: "geo",
    });
    expect(pickDestination(link, { platform: "android", country: "IN" }).reason).toBe("geo");
  });

  it("puts geo targeting ahead of an A/B split", () => {
    expect(
      pickDestination(targeted, { platform: "other", country: "DE", random: () => 0.9 }),
    ).toEqual({
      url: "https://example.de/",
      variant: null,
      reason: "geo",
    });
  });

  it("skips geo targeting for an untargeted or unknown country", () => {
    const random = () => 0;
    expect(pickDestination(targeted, { platform: "other", country: "US", random }).reason).toBe(
      "ab",
    );
    expect(pickDestination(targeted, { platform: "other", country: null, random }).reason).toBe(
      "ab",
    );
  });

  it("splits traffic using the injected random source", () => {
    const ctx = { platform: "other" as const, country: null };
    expect(pickDestination(targeted, { ...ctx, random: () => 0 })).toEqual({
      url: "https://example.com/a",
      variant: 0,
      reason: "ab",
    });
    expect(pickDestination(targeted, { ...ctx, random: () => 0.75 })).toEqual({
      url: "https://example.com/b",
      variant: 1,
      reason: "ab",
    });
  });

  it("honours a valid sticky variant without rolling the dice", () => {
    const random = vi.fn(() => 0);
    const result = pickDestination(targeted, {
      platform: "other",
      country: null,
      stickyVariant: 1,
      random,
    });
    expect(result).toEqual({ url: "https://example.com/b", variant: 1, reason: "ab" });
    expect(random).not.toHaveBeenCalled();
  });

  it("honours sticky variant 0", () => {
    const result = pickDestination(targeted, {
      platform: "other",
      country: null,
      stickyVariant: 0,
      random: () => 0.99,
    });
    expect(result.variant).toBe(0);
  });

  it.each([2, 5, -1])("re-rolls when the sticky variant %i is out of range", (stickyVariant) => {
    const random = vi.fn(() => 0.75);
    const result = pickDestination(targeted, {
      platform: "other",
      country: null,
      stickyVariant,
      random,
    });
    expect(result.variant).toBe(1);
    expect(random).toHaveBeenCalledTimes(1);
  });

  it.each([null, undefined])("rolls when there is no sticky variant (%s)", (stickyVariant) => {
    const random = vi.fn(() => 0.1);
    const result = pickDestination(targeted, {
      platform: "other",
      country: null,
      stickyVariant,
      random,
    });
    expect(result.variant).toBe(0);
    expect(random).toHaveBeenCalledTimes(1);
  });

  it("falls back to Math.random when no random source is injected", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.75);
    expect(pickDestination(targeted, { platform: "other", country: null }).variant).toBe(1);
    expect(spy).toHaveBeenCalled();
  });

  it("ignores an A/B list with fewer than two variants", () => {
    const link = makeLink({ abVariants: [{ url: "https://example.com/only", weight: 100 }] });
    expect(pickDestination(link, { platform: "other", country: null, random: () => 0 })).toEqual({
      url: "https://example.com/landing",
      variant: null,
      reason: "default",
    });
  });
});

describe("weightedPick", () => {
  /** Sweep r evenly across [0, 1) and count which index each value picks. */
  function distribution(weights: number[], samples = 1000): number[] {
    const counts = weights.map(() => 0);
    for (let i = 0; i < samples; i++) counts[weightedPick(weights, (i + 0.5) / samples)]++;
    return counts;
  }

  it("picks in proportion to the weights", () => {
    expect(distribution([1, 3])).toEqual([250, 750]);
    expect(distribution([2, 1, 1])).toEqual([500, 250, 250]);
    expect(distribution([50, 30, 20])).toEqual([500, 300, 200]);
  });

  it("never picks a zero-weight entry", () => {
    expect(distribution([0, 5, 0])).toEqual([0, 1000, 0]);
    expect(distribution([1, 0, 1])).toEqual([500, 0, 500]);
  });

  it("treats negative weights as zero", () => {
    expect(distribution([-10, 1])).toEqual([0, 1000]);
    expect(weightedPick([1, -5, 1], 0.4)).toBe(0);
    expect(weightedPick([1, -5, 1], 0.6)).toBe(2);
  });

  it("returns 0 when no weight is positive", () => {
    expect(weightedPick([0, 0], 0.5)).toBe(0);
    expect(weightedPick([-1, -2], 0.5)).toBe(0);
    expect(weightedPick([], 0.5)).toBe(0);
  });

  it("maps r = 0 to the first positive weight", () => {
    expect(weightedPick([3, 1], 0)).toBe(0);
    expect(weightedPick([0, 2, 1], 0)).toBe(1);
  });

  it("maps r = 0.999 to the last positive weight", () => {
    expect(weightedPick([3, 1], 0.999)).toBe(1);
    expect(weightedPick([1, 1, 0], 0.999)).toBe(1);
  });

  it("uses half-open buckets at the boundary", () => {
    expect(weightedPick([1, 1], 0.4999)).toBe(0);
    expect(weightedPick([1, 1], 0.5)).toBe(1);
  });
});

describe("forwardQueryParams", () => {
  const params = (query: string) => new URLSearchParams(query);

  it("returns the destination unchanged with no incoming params", () => {
    expect(forwardQueryParams("https://example.com/a?x=1", params(""))).toBe(
      "https://example.com/a?x=1",
    );
  });

  it("returns the destination unchanged when only internal params arrive", () => {
    expect(forwardQueryParams("https://example.com/a", params("qr=1&src=bio&pw=hunter2"))).toBe(
      "https://example.com/a",
    );
  });

  it("starts a query string when the destination has none", () => {
    expect(forwardQueryParams("https://example.com/path", params("utm_source=x"))).toBe(
      "https://example.com/path?utm_source=x",
    );
  });

  it("appends without re-encoding the destination's own query", () => {
    const signed = "https://example.com/s?q=a%20b&sig=AbC%2F%2B%3D&plus=a+b";
    expect(forwardQueryParams(signed, params("ref=tw"))).toBe(`${signed}&ref=tw`);
  });

  it("keeps the hash fragment after the forwarded params", () => {
    expect(forwardQueryParams("https://example.com/page?a=1#section-2", params("b=2"))).toBe(
      "https://example.com/page?a=1&b=2#section-2",
    );
  });

  it("does not mistake a ? inside a hash route for the query string", () => {
    expect(forwardQueryParams("https://app.example.com/#/route?x=1", params("x=2"))).toBe(
      "https://app.example.com/?x=2#/route?x=1",
    );
  });

  it("does not double the separator when the destination ends with ? or &", () => {
    expect(forwardQueryParams("https://example.com/path?", params("a=1"))).toBe(
      "https://example.com/path?a=1",
    );
    expect(forwardQueryParams("https://example.com/path?x=1&", params("a=1"))).toBe(
      "https://example.com/path?x=1&a=1",
    );
  });

  it("encodes incoming values", () => {
    const incoming = new URLSearchParams({ q: "hello world", amp: "a&b" });
    expect(forwardQueryParams("https://example.com/", incoming)).toBe(
      "https://example.com/?q=hello+world&amp=a%26b",
    );
  });

  it("lets the incoming value win on a key collision", () => {
    expect(
      forwardQueryParams(
        "https://example.com/?utm_source=newsletter&id=7",
        params("utm_source=twitter"),
      ),
    ).toBe("https://example.com/?id=7&utm_source=twitter");
  });

  it("replaces every existing value of a colliding key", () => {
    expect(forwardQueryParams("https://example.com/?k=1&k=2&z=0", params("k=9"))).toBe(
      "https://example.com/?z=0&k=9",
    );
  });

  it("forwards repeated incoming values on a collision", () => {
    expect(forwardQueryParams("https://example.com/?tag=old", params("tag=a&tag=b"))).toBe(
      "https://example.com/?tag=a&tag=b",
    );
  });

  it("keeps the fragment on a collision", () => {
    expect(forwardQueryParams("https://example.com/?a=1#top", params("a=2"))).toBe(
      "https://example.com/?a=2#top",
    );
  });

  it("strips internal params on both the append and collision paths", () => {
    expect(forwardQueryParams("https://example.com/", params("qr=1&ref=x&pw=secret"))).toBe(
      "https://example.com/?ref=x",
    );
    expect(
      forwardQueryParams("https://example.com/?a=1", params("a=2&qr=1&pw=secret&src=bio")),
    ).toBe("https://example.com/?a=2");
  });

  it("does not treat a destination's own internal-looking params as incoming", () => {
    expect(forwardQueryParams("https://example.com/?src=docs", params("ref=x"))).toBe(
      "https://example.com/?src=docs&ref=x",
    );
  });

  it.each(["not a url", "/relative/path", ""])(
    "returns an unparseable destination %o unchanged",
    (dest) => {
      expect(forwardQueryParams(dest, params("a=1"))).toBe(dest);
    },
  );

  it("marks exactly qr, pw and src as internal", () => {
    expect([...INTERNAL_PARAMS].sort()).toEqual(["pw", "qr", "src"]);
  });
});

describe("shouldServePreviewCard", () => {
  it("never intercepts human visitors", () => {
    const link = makeLink({ hasPassword: true, ogTitle: "Custom" });
    expect(shouldServePreviewCard(link, false)).toBe(false);
  });

  it("shields a password-protected destination from preview bots", () => {
    expect(shouldServePreviewCard(makeLink({ hasPassword: true }), true)).toBe(true);
  });

  it.each([
    { ogTitle: "Title" },
    { ogDescription: "Description" },
    { ogImage: "https://example.com/og.png" },
  ])("serves the custom preview %o to bots", (overrides) => {
    expect(shouldServePreviewCard(makeLink(overrides), true)).toBe(true);
  });

  it("lets bots follow an ordinary link", () => {
    expect(shouldServePreviewCard(makeLink(), true)).toBe(false);
  });

  it("ignores empty preview fields", () => {
    expect(
      shouldServePreviewCard(makeLink({ ogTitle: "", ogDescription: "", ogImage: "" }), true),
    ).toBe(false);
  });
});

describe("visitSource", () => {
  it.each([
    ["qr=1", "qr"],
    ["src=bio", "bio"],
    ["", "link"],
    ["qr=0", "link"],
    ["qr=true", "link"],
    ["src=newsletter", "link"],
    ["qr=1&src=bio", "qr"],
  ])("classifies %o as %s", (query, expected) => {
    expect(visitSource(new URLSearchParams(query))).toBe(expected);
  });
});

describe("parseCachedRedirectLink", () => {
  const current = makeLink({ expiresAt: NOW, geoTargets: { US: "https://example.com/us" } });

  it("accepts an already-deserialised v2 entry", () => {
    expect(parseCachedRedirectLink(current)).toBe(current);
  });

  it("accepts a v2 entry stored as a JSON string", () => {
    expect(parseCachedRedirectLink(JSON.stringify(current))).toEqual(current);
  });

  it("rejects the v1 cache shape so it is rebuilt", () => {
    const v1 = { id: "link_1", originalUrl: "https://example.com", expiresAt: null };
    expect(parseCachedRedirectLink(v1)).toBeNull();
    expect(parseCachedRedirectLink(JSON.stringify(v1))).toBeNull();
  });

  it("rejects a bare URL string written by the oldest builds", () => {
    expect(parseCachedRedirectLink("https://example.com/landing")).toBeNull();
    expect(parseCachedRedirectLink(JSON.stringify("https://example.com/landing"))).toBeNull();
  });

  it.each(["{not json", "", "null", "42", "[]", "undefined"])("rejects garbage %o", (raw) => {
    expect(parseCachedRedirectLink(raw)).toBeNull();
  });

  // Wrapped in arrays so it.each does not spread the empty-array case into no argument.
  it.each([[null], [undefined], [42], [true], [[]]])("rejects the non-object %o", (raw) => {
    expect(parseCachedRedirectLink(raw)).toBeNull();
  });

  it.each([
    { ...current, v: 1 },
    { ...current, v: 3 },
    { ...current, v: "2" },
    { ...current, id: 7 },
    { ...current, url: null },
  ])("rejects an entry with a bad version or key field", (raw) => {
    expect(parseCachedRedirectLink(raw)).toBeNull();
  });
});

describe("parseGeoTargets", () => {
  it("keeps a valid country map", () => {
    const map = { US: "https://us.example.com", IN: "https://in.example.com" };
    expect(parseGeoTargets(map)).toEqual(map);
  });

  it("drops malformed keys and values", () => {
    expect(
      parseGeoTargets({
        us: "https://lower.example.com",
        USA: "https://three.example.com",
        GB: "",
        DE: 5,
        JP: null,
        FR: "https://fr.example.com",
      }),
    ).toEqual({ FR: "https://fr.example.com" });
  });

  it.each([[null], [undefined], ["US"], [5], [[]], [["US"]], [{}], [{ us: "https://x.com" }]])(
    "returns null for %o",
    (value) => {
      expect(parseGeoTargets(value)).toBeNull();
    },
  );
});

describe("parseVariants", () => {
  const a = { url: "https://example.com/a", weight: 60 };
  const b = { url: "https://example.com/b", weight: 40 };

  it("keeps a valid list", () => {
    expect(parseVariants([a, b])).toEqual([a, b]);
  });

  it("drops malformed entries and keeps the order of the rest", () => {
    const c = { url: "https://example.com/c", weight: 1 };
    expect(
      parseVariants([
        a,
        { url: "https://example.com/zero", weight: 0 },
        { url: "https://example.com/neg", weight: -5 },
        { url: "https://example.com/nan", weight: Number.NaN },
        { url: "https://example.com/str", weight: "50" },
        { weight: 50 },
        null,
        "https://example.com/bare",
        b,
        c,
      ]),
    ).toEqual([a, b, c]);
  });

  it("returns null when fewer than two valid variants remain", () => {
    expect(parseVariants([a])).toBeNull();
    expect(parseVariants([a, { url: "https://example.com/zero", weight: 0 }])).toBeNull();
    expect(parseVariants([])).toBeNull();
  });

  it.each([null, undefined, {}, "[]", 3])("returns null for the non-array %o", (value) => {
    expect(parseVariants(value)).toBeNull();
  });
});

describe("toRedirectLink", () => {
  it("maps a database row to the cache shape", () => {
    const row = makeRow({
      domain: "go.brand.com",
      expiresAt: new Date(NOW + 1000),
      startsAt: new Date(NOW - 1000),
      maxClicks: 10,
      expiredUrl: "https://example.com/expired",
      redirectType: 301,
      forwardQuery: false,
      hideReferrer: true,
      cloaked: true,
      iosUrl: "https://apps.apple.com/app/id1",
      androidUrl: "https://play.google.com/store/apps/details?id=x",
      geoTargets: { US: "https://us.example.com" },
      abVariants: [
        { url: "https://example.com/a", weight: 1 },
        { url: "https://example.com/b", weight: 1 },
      ],
      ogTitle: "OG",
      ogDescription: "Desc",
      ogImage: "https://example.com/og.png",
    });

    expect(toRedirectLink(row)).toEqual({
      v: 2,
      id: "link_1",
      userId: "user_1",
      domain: "go.brand.com",
      shortCode: "abc1234",
      url: "https://example.com/landing",
      title: "Landing",
      expiresAt: NOW + 1000,
      startsAt: NOW - 1000,
      maxClicks: 10,
      disabled: false,
      banned: false,
      hasPassword: false,
      expiredUrl: "https://example.com/expired",
      redirectType: 301,
      forwardQuery: false,
      hideReferrer: true,
      cloaked: true,
      iosUrl: "https://apps.apple.com/app/id1",
      androidUrl: "https://play.google.com/store/apps/details?id=x",
      geoTargets: { US: "https://us.example.com" },
      abVariants: [
        { url: "https://example.com/a", weight: 1 },
        { url: "https://example.com/b", weight: 1 },
      ],
      ogTitle: "OG",
      ogDescription: "Desc",
      ogImage: "https://example.com/og.png",
    });
  });

  it("flags a password without copying the hash into the cache", () => {
    const hash = "$2b$10$abcdefghijklmnopqrstuuJ0dCq1z7Yb4m3p8bZsQd7rS9xT2u";
    const result = toRedirectLink(makeRow({ password: hash }));
    expect(result.hasPassword).toBe(true);
    expect(JSON.stringify(result)).not.toContain(hash);
  });

  it("does not copy private notes into the cache", () => {
    expect(JSON.stringify(toRedirectLink(makeRow()))).not.toContain("private notes");
  });

  it("is banned when the link itself is banned", () => {
    expect(toRedirectLink(makeRow({ bannedAt: new Date(NOW) })).banned).toBe(true);
  });

  it("is banned when the owner is banned", () => {
    expect(toRedirectLink({ ...makeRow(), user: { bannedAt: new Date(NOW) } }).banned).toBe(true);
  });

  it.each([{ user: null }, { user: { bannedAt: null } }, {}])(
    "is not banned for a clean link and owner %o",
    (extra) => {
      expect(toRedirectLink({ ...makeRow(), ...extra }).banned).toBe(false);
    },
  );

  it.each([301, 302, 307, 308])("keeps the redirect type %i", (redirectType) => {
    expect(toRedirectLink(makeRow({ redirectType })).redirectType).toBe(redirectType);
  });

  it.each([200, 300, 303, 0])("coerces the unsupported redirect type %i to 302", (redirectType) => {
    expect(toRedirectLink(makeRow({ redirectType })).redirectType).toBe(302);
  });

  it("nulls malformed targeting JSON", () => {
    const result = toRedirectLink(
      makeRow({ geoTargets: ["US"], abVariants: [{ url: "https://example.com/a", weight: 1 }] }),
    );
    expect(result.geoTargets).toBeNull();
    expect(result.abVariants).toBeNull();
  });

  it("survives a round trip through the cache serialisation", () => {
    const link = toRedirectLink(
      makeRow({ expiresAt: new Date(NOW), geoTargets: { IN: "https://x.in" } }),
    );
    expect(parseCachedRedirectLink(JSON.stringify(link))).toEqual(link);
  });
});

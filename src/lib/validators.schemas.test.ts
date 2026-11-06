import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  ALIAS_MAX_LENGTH,
  STATS_PERIODS,
  apiKeySchema,
  bioSchema,
  bulkActionSchema,
  createLinkSchema,
  domainSchema,
  firstZodError,
  formatZodErrorMessage,
  linkQuerySchema,
  reportSchema,
  statsQuerySchema,
  tagSchema,
  tagUpdateSchema,
  unlockSchema,
  updateLinkSchema,
  webhookSchema,
  webhookUpdateSchema,
} from "@/lib/validators";

/**
 * Covers the schemas added for the Pro feature set. validators.test.ts keeps
 * the original create/update/register cases.
 */

const URL_OK = "https://example.com";

function create(extra: Record<string, unknown>) {
  return createLinkSchema.safeParse({ url: URL_OK, ...extra });
}

function messages(result: { success: boolean; error?: z.ZodError }): string[] {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe("custom aliases", () => {
  it.each([
    "🚀",
    "🚀launch",
    "🦊🍕🚀🌙",
    "👍🏽",
    "👨‍👩‍👧",
    "❤️",
    "🇺🇸🇬🇧",
    "café",
    "日本語",
    "my_link-2",
    "ABC",
  ])("accepts %s", (alias) => {
    expect(create({ customAlias: alias }).success).toBe(true);
  });

  it.each(["ab", "日本", "x"])("rejects the short text alias %s", (alias) => {
    const result = create({ customAlias: alias });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain("Alias must be at least 3 characters");
  });

  it.each(["#", "*", "#launch", "launch#1", "a*b", "#️⃣", "*️⃣"])(
    "rejects %s, since # and * are not emoji and # starts a fragment",
    (alias) => {
      expect(create({ customAlias: alias }).success).toBe(false);
    },
  );

  it.each(["my link", "a/b", "a?b", "a.b", "a%20b", "<script>"])(
    "rejects the unsafe alias %o",
    (alias) => {
      expect(create({ customAlias: alias }).success).toBe(false);
    },
  );

  it("measures length in code points, so 50 emoji fit", () => {
    expect(ALIAS_MAX_LENGTH).toBe(50);
    expect("🚀".repeat(50)).toHaveLength(100);
    expect(create({ customAlias: "🚀".repeat(50) }).success).toBe(true);
    expect(create({ customAlias: `${"x".repeat(49)}🚀` }).success).toBe(true);
  });

  it("rejects 51 code points", () => {
    const result = create({ customAlias: "🚀".repeat(51) });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain("Alias must be at most 50 characters");
    expect(create({ customAlias: "a".repeat(51) }).success).toBe(false);
  });

  it.each(["Dashboard", "API", "Link-Expired", " admin ", "QR"])(
    "rejects the reserved word %o case-insensitively",
    (alias) => {
      const result = create({ customAlias: alias });
      expect(result.success).toBe(false);
      expect(messages(result)).toContain("This alias is reserved. Please choose another.");
    },
  );

  it("trims the alias", () => {
    expect(create({ customAlias: "  my-link  " }).data?.customAlias).toBe("my-link");
  });

  it("validates aliases on update too", () => {
    expect(updateLinkSchema.safeParse({ customAlias: "🚀" }).success).toBe(true);
    expect(updateLinkSchema.safeParse({ customAlias: "#" }).success).toBe(false);
    expect(updateLinkSchema.safeParse({ customAlias: "docs" }).success).toBe(false);
  });
});

describe("geoTargets", () => {
  it("normalises country codes to upper case", () => {
    const result = create({
      geoTargets: {
        us: "https://us.example.com",
        " in ": "https://in.example.com",
        GB: "https://gb.example.com",
      },
    });
    expect(result.success).toBe(true);
    expect(result.data?.geoTargets).toEqual({
      US: "https://us.example.com",
      IN: "https://in.example.com",
      GB: "https://gb.example.com",
    });
  });

  it.each(["USA", "U", "1A", "U$", ""])("rejects the country code %o", (code) => {
    expect(create({ geoTargets: { [code]: "https://x.example.com" } }).success).toBe(false);
  });

  it.each(["javascript:alert(1)", "not a url", "ftp://example.com"])(
    "rejects the target URL %o",
    (url) => {
      expect(create({ geoTargets: { US: url } }).success).toBe(false);
    },
  );

  it("accepts null to clear the targets, or no field at all", () => {
    expect(create({ geoTargets: null }).data?.geoTargets).toBeNull();
    expect(create({}).data?.geoTargets).toBeUndefined();
  });

  it("allows at most 50 countries", () => {
    const codes = Array.from(
      { length: 51 },
      (_, i) => String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)),
    );
    const targets = (n: number) =>
      Object.fromEntries(codes.slice(0, n).map((c) => [c, "https://x.example.com"]));
    expect(create({ geoTargets: targets(50) }).success).toBe(true);
    const result = create({ geoTargets: targets(51) });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain("At most 50 countries");
  });
});

describe("abVariants", () => {
  const variant = (weight: number, url = "https://example.com/v") => ({ url, weight });

  it("accepts between two and five variants", () => {
    expect(create({ abVariants: [variant(50), variant(50)] }).success).toBe(true);
    expect(create({ abVariants: Array.from({ length: 5 }, () => variant(20)) }).success).toBe(true);
  });

  it("rejects a single variant", () => {
    const result = create({ abVariants: [variant(100)] });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain("An A/B test needs at least two destinations");
  });

  it("rejects six variants", () => {
    const result = create({ abVariants: Array.from({ length: 6 }, () => variant(10)) });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain("At most five destinations");
  });

  it.each([1, 100])("accepts the weight %i", (weight) => {
    expect(create({ abVariants: [variant(weight), variant(50)] }).success).toBe(true);
  });

  it.each([0, -1, 101, 1.5, Number.NaN])("rejects the weight %s", (weight) => {
    expect(create({ abVariants: [variant(weight), variant(50)] }).success).toBe(false);
  });

  it("requires http(s) variant URLs", () => {
    expect(create({ abVariants: [variant(50, "ftp://example.com"), variant(50)] }).success).toBe(
      false,
    );
  });

  it("accepts null to end the test", () => {
    expect(create({ abVariants: null }).data?.abVariants).toBeNull();
  });
});

describe("startsAt and expiresAt", () => {
  const NOW = new Date("2026-11-06T12:00:00.000Z");
  const at = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a start before the expiry", () => {
    expect(create({ startsAt: at(1), expiresAt: at(2) }).success).toBe(true);
  });

  it.each([
    [3, 2],
    [2, 2],
  ])("rejects a start on day %i with expiry on day %i", (start, expiry) => {
    const result = create({ startsAt: at(start), expiresAt: at(expiry) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      message: "The start date must be before the expiration date",
      path: ["startsAt"],
    });
  });

  it("allows either date on its own, including a start in the past", () => {
    expect(create({ startsAt: at(-5) }).success).toBe(true);
    expect(create({ expiresAt: at(5) }).success).toBe(true);
    expect(create({ startsAt: null, expiresAt: null }).success).toBe(true);
  });

  it("rejects an expiry in the past", () => {
    expect(create({ expiresAt: at(-1) }).success).toBe(false);
  });

  it("rejects a malformed start date", () => {
    const result = create({ startsAt: "next tuesday" });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain("Invalid date format");
  });

  it("applies the same ordering rule on update", () => {
    expect(updateLinkSchema.safeParse({ startsAt: at(3), expiresAt: at(2) }).success).toBe(false);
    expect(updateLinkSchema.safeParse({ startsAt: at(1), expiresAt: at(2) }).success).toBe(true);
  });
});

describe("optional URL and text fields", () => {
  const URL_FIELDS = ["expiredUrl", "iosUrl", "androidUrl", "ogImage"] as const;

  it.each(URL_FIELDS)("turns an empty %s into null so it clears the field", (field) => {
    const result = create({ [field]: "" });
    expect(result.success).toBe(true);
    expect(result.data?.[field]).toBeNull();
  });

  it.each(URL_FIELDS)("accepts null for %s", (field) => {
    expect(create({ [field]: null }).data?.[field]).toBeNull();
  });

  it.each(URL_FIELDS)("leaves an omitted %s undefined so updates skip it", (field) => {
    expect(create({}).data?.[field]).toBeUndefined();
  });

  it.each(URL_FIELDS)("trims a valid %s", (field) => {
    expect(create({ [field]: "  https://apps.example.com/x  " }).data?.[field]).toBe(
      "https://apps.example.com/x",
    );
  });

  it.each(URL_FIELDS)("rejects a javascript: URL in %s", (field) => {
    expect(create({ [field]: "javascript:alert(1)" }).success).toBe(false);
  });

  it("turns blank text fields into null", () => {
    const result = create({ title: "   ", ogTitle: "", ogDescription: "" });
    expect(result.data).toMatchObject({ title: null, ogTitle: null, ogDescription: null });
  });

  it.each([
    ["title", 200],
    ["ogTitle", 200],
    ["ogDescription", 500],
    ["description", 2000],
  ])("limits %s to %i characters", (field, max) => {
    expect(create({ [field]: "x".repeat(max) }).success).toBe(true);
    expect(create({ [field]: "x".repeat(max + 1) }).success).toBe(false);
  });
});

describe("redirectType", () => {
  it.each([301, 302, 307, 308])("accepts %i", (redirectType) => {
    expect(create({ redirectType }).data?.redirectType).toBe(redirectType);
  });

  it.each([200, 300, 303, 304, "301", null])("rejects %o", (redirectType) => {
    expect(create({ redirectType }).success).toBe(false);
  });
});

describe("updateLinkSchema", () => {
  it("accepts the url field", () => {
    expect(updateLinkSchema.safeParse({ url: "https://new.example.com" }).data?.url).toBe(
      "https://new.example.com",
    );
  });

  it("accepts the legacy originalUrl field", () => {
    expect(
      updateLinkSchema.safeParse({ originalUrl: "https://new.example.com" }).data?.originalUrl,
    ).toBe("https://new.example.com");
  });

  it("rejects an empty object", () => {
    const result = updateLinkSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(messages(result)).toContain("At least one field must be provided to update");
  });

  it("rejects a dangerous scheme in url", () => {
    expect(updateLinkSchema.safeParse({ url: "javascript:alert(1)" }).success).toBe(false);
  });

  it("accepts a single option such as disabled: false", () => {
    expect(updateLinkSchema.safeParse({ disabled: false }).success).toBe(true);
  });

  it("lower-cases the domain", () => {
    expect(updateLinkSchema.safeParse({ domain: " Go.Example.COM " }).data?.domain).toBe(
      "go.example.com",
    );
  });
});

describe("createLinkSchema domain", () => {
  it("defaults to the app domain and lower-cases a custom one", () => {
    expect(create({}).data?.domain).toBe("");
    expect(create({ domain: null }).data?.domain).toBe("");
    expect(create({ domain: "Go.Brand.COM" }).data?.domain).toBe("go.brand.com");
  });
});

describe("statsQuerySchema", () => {
  it.each(STATS_PERIODS)("accepts the period %s", (period) => {
    expect(statsQuerySchema.safeParse({ period }).data?.period).toBe(period);
  });

  it("names the valid periods when rejecting one", () => {
    const result = statsQuerySchema.safeParse({ period: "1y" });
    expect(result.success).toBe(false);
    expect(messages(result)[0]).toBe("Period must be one of: 24h, 7d, 30d, 90d, 365d, all");
  });

  it.each([
    [{ includeBots: "true" }, true],
    [{ includeBots: "false" }, false],
    [{}, false],
  ])("turns %o into includeBots %s", (query, expected) => {
    expect(statsQuerySchema.safeParse(query).data?.includeBots).toBe(expected);
  });

  it.each(["yes", "1", true])("rejects includeBots %o", (includeBots) => {
    expect(statsQuerySchema.safeParse({ includeBots }).success).toBe(false);
  });

  it("caps the timezone length", () => {
    expect(statsQuerySchema.safeParse({ tz: "Asia/Kolkata" }).data?.tz).toBe("Asia/Kolkata");
    expect(statsQuerySchema.safeParse({ tz: "x".repeat(65) }).success).toBe(false);
  });
});

describe("linkQuerySchema status and sort", () => {
  it("defaults status, sort and order", () => {
    expect(linkQuerySchema.parse({})).toMatchObject({
      status: "all",
      sort: "createdAt",
      order: "desc",
    });
  });

  it("rejects an unknown status or sort", () => {
    expect(linkQuerySchema.safeParse({ status: "deleted" }).success).toBe(false);
    expect(linkQuerySchema.safeParse({ sort: "password" }).success).toBe(false);
  });
});

describe("domainSchema", () => {
  it.each([
    ["Go.Example.com", "go.example.com"],
    ["https://go.example.com/some/path?x=1", "go.example.com"],
    ["http://go.example.com/", "go.example.com"],
    ["go.example.com.", "go.example.com"],
    ["  links.brand.co.uk  ", "links.brand.co.uk"],
    ["xn--bcher-kva.example", "xn--bcher-kva.example"],
    [`${"a".repeat(63)}.com`, `${"a".repeat(63)}.com`],
  ])("normalises %o to %s", (input, expected) => {
    expect(domainSchema.safeParse({ hostname: input }).data?.hostname).toBe(expected);
  });

  it.each([
    "localhost",
    "example",
    "",
    "-bad.example.com",
    "bad-.example.com",
    "exa mple.com",
    "example.c",
    "a.b",
    "example.123",
    "1.2.3.4",
    "go.example.com:8080",
    "my_site.example.com",
    "ftp://go.example.com",
    `${"a".repeat(64)}.com`,
  ])("rejects %o", (input) => {
    const result = domainSchema.safeParse({ hostname: input });
    expect(result.success).toBe(false);
  });

  it("explains the expected format", () => {
    expect(messages(domainSchema.safeParse({ hostname: "localhost" }))).toContain(
      "Enter a domain like go.example.com",
    );
  });
});

describe("bioSchema", () => {
  it("lower-cases and trims the slug and applies defaults", () => {
    expect(bioSchema.parse({ slug: " My.Name_1 " })).toEqual({
      slug: "my.name_1",
      theme: "midnight",
      published: true,
    });
  });

  it.each(["abc", "a".repeat(30), "a-b", "a.b", "a_b", "123"])("accepts the slug %o", (slug) => {
    expect(bioSchema.safeParse({ slug }).success).toBe(true);
  });

  it.each(["ab", "a".repeat(31), "my name", "a/b", "émile", "abc!", "@abc", ""])(
    "rejects the slug %o",
    (slug) => {
      expect(bioSchema.safeParse({ slug }).success).toBe(false);
    },
  );

  it("rejects an unknown theme", () => {
    expect(bioSchema.safeParse({ slug: "abc", theme: "neon" }).success).toBe(false);
  });

  it("accepts known socials and rejects unknown networks", () => {
    expect(
      bioSchema.safeParse({ slug: "abc", socials: { x: "https://x.com/me", github: "me" } })
        .success,
    ).toBe(true);
    expect(bioSchema.safeParse({ slug: "abc", socials: { myspace: "me" } }).success).toBe(false);
    expect(bioSchema.safeParse({ slug: "abc", socials: null }).success).toBe(true);
  });

  it("clears an empty avatar and rejects a dangerous one", () => {
    expect(bioSchema.parse({ slug: "abc", avatarUrl: "" }).avatarUrl).toBeNull();
    expect(bioSchema.safeParse({ slug: "abc", avatarUrl: "javascript:alert(1)" }).success).toBe(
      false,
    );
  });

  it("limits the display name and bio", () => {
    expect(bioSchema.safeParse({ slug: "abc", displayName: "x".repeat(61) }).success).toBe(false);
    expect(bioSchema.safeParse({ slug: "abc", bio: "x".repeat(301) }).success).toBe(false);
  });
});

describe("bulkActionSchema", () => {
  it("accepts an action that needs no tag", () => {
    expect(bulkActionSchema.safeParse({ ids: ["a", "b"], action: "delete" }).success).toBe(true);
  });

  it.each(["addTag", "removeTag"])("requires a tag for %s", (action) => {
    const result = bulkActionSchema.safeParse({ ids: ["a"], action });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain("A tag is required for this action");
    expect(bulkActionSchema.safeParse({ ids: ["a"], action, tag: "launch" }).success).toBe(true);
  });

  it("rejects a blank tag", () => {
    expect(bulkActionSchema.safeParse({ ids: ["a"], action: "addTag", tag: "   " }).success).toBe(
      false,
    );
  });

  it("bounds the selection between 1 and 500 non-empty ids", () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `id${i}`);
    expect(bulkActionSchema.safeParse({ ids: [], action: "delete" }).success).toBe(false);
    expect(bulkActionSchema.safeParse({ ids: ids(500), action: "delete" }).success).toBe(true);
    expect(bulkActionSchema.safeParse({ ids: ids(501), action: "delete" }).success).toBe(false);
    expect(bulkActionSchema.safeParse({ ids: [""], action: "delete" }).success).toBe(false);
  });

  it("rejects an unknown action", () => {
    expect(bulkActionSchema.safeParse({ ids: ["a"], action: "ban" }).success).toBe(false);
  });
});

describe("reportSchema", () => {
  it("defaults the domain to the app domain", () => {
    expect(reportSchema.parse({ code: "abc", reason: "phishing" })).toEqual({
      code: "abc",
      domain: "",
      reason: "phishing",
    });
  });

  it.each(["phishing", "malware", "spam", "illegal", "other"])(
    "accepts the reason %s",
    (reason) => {
      expect(reportSchema.safeParse({ code: "abc", reason }).success).toBe(true);
    },
  );

  it("rejects an unknown reason", () => {
    expect(reportSchema.safeParse({ code: "abc", reason: "boring" }).success).toBe(false);
  });

  it("accepts an empty or valid email and rejects a malformed one", () => {
    expect(reportSchema.safeParse({ code: "abc", reason: "spam", email: "" }).success).toBe(true);
    expect(
      reportSchema.safeParse({ code: "abc", reason: "spam", email: "me@example.com" }).success,
    ).toBe(true);
    expect(reportSchema.safeParse({ code: "abc", reason: "spam", email: "nope" }).success).toBe(
      false,
    );
  });

  it("bounds the code and details", () => {
    expect(reportSchema.safeParse({ code: "", reason: "spam" }).success).toBe(false);
    expect(reportSchema.safeParse({ code: "x".repeat(201), reason: "spam" }).success).toBe(false);
    expect(
      reportSchema.safeParse({ code: "abc", reason: "spam", details: "x".repeat(1001) }).success,
    ).toBe(false);
    expect(reportSchema.parse({ code: "abc", reason: "spam", details: "  why  " }).details).toBe(
      "why",
    );
  });
});

describe("unlockSchema", () => {
  it("defaults the domain", () => {
    expect(unlockSchema.parse({ code: "abc", password: "secret" })).toEqual({
      code: "abc",
      domain: "",
      password: "secret",
    });
  });

  it("asks for the password when it is empty", () => {
    const result = unlockSchema.safeParse({ code: "abc", password: "" });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain("Enter the password");
  });

  it("bounds the password and code", () => {
    expect(unlockSchema.safeParse({ code: "abc", password: "x".repeat(101) }).success).toBe(false);
    expect(unlockSchema.safeParse({ code: "", password: "x" }).success).toBe(false);
  });
});

describe("tag, webhook and API key schemas", () => {
  it("defaults the tag colour and rejects unknown colours", () => {
    expect(tagSchema.parse({ name: " News " })).toEqual({ name: "News", color: "blue" });
    expect(tagSchema.safeParse({ name: "News", color: "chartreuse" }).success).toBe(false);
  });

  it("requires something to update on a tag", () => {
    expect(messages(tagUpdateSchema.safeParse({}))).toContain("Nothing to update");
    expect(tagUpdateSchema.safeParse({ color: "red" }).success).toBe(true);
  });

  /*
   * Regression: tagSchema.partial() kept color's default, so renaming a tag
   * parsed to { name, color: "blue" } and the update reset its colour.
   */
  it("does not inject the default colour into a rename", () => {
    expect(tagUpdateSchema.parse({ name: "Renamed" })).toEqual({ name: "Renamed" });
    expect(tagUpdateSchema.safeParse({ color: "chartreuse" }).success).toBe(false);
  });

  it("requires known webhook events and an http(s) URL", () => {
    expect(
      webhookSchema.parse({ url: "https://hooks.example.com", events: ["link.created"] }).enabled,
    ).toBe(true);
    expect(webhookSchema.safeParse({ url: "https://hooks.example.com", events: [] }).success).toBe(
      false,
    );
    expect(
      webhookSchema.safeParse({ url: "https://hooks.example.com", events: ["link.exploded"] })
        .success,
    ).toBe(false);
    expect(
      webhookSchema.safeParse({ url: "file:///etc/passwd", events: ["link.created"] }).success,
    ).toBe(false);
  });

  it("requires something to update on a webhook", () => {
    expect(messages(webhookUpdateSchema.safeParse({}))).toContain("Nothing to update");
    expect(webhookUpdateSchema.safeParse({ enabled: false }).success).toBe(true);
  });

  it("bounds API key names and expiry", () => {
    expect(apiKeySchema.parse({ name: "  CI  " })).toEqual({ name: "CI" });
    expect(apiKeySchema.safeParse({ name: "   " }).success).toBe(false);
    expect(apiKeySchema.safeParse({ name: "CI", expiresInDays: 0 }).success).toBe(false);
    expect(apiKeySchema.safeParse({ name: "CI", expiresInDays: 3650 }).success).toBe(true);
    expect(apiKeySchema.safeParse({ name: "CI", expiresInDays: 3651 }).success).toBe(false);
    expect(apiKeySchema.safeParse({ name: "CI", expiresInDays: null }).success).toBe(true);
  });
});

describe("error formatting", () => {
  it("returns the first message, or a generic one when there are no issues", () => {
    const result = unlockSchema.safeParse({ code: "", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstZodError(result.error)).toBe(result.error.issues[0].message);
    expect(firstZodError(new z.ZodError([]))).toBe("Invalid input");
  });

  it("joins every message with a full stop", () => {
    const single = unlockSchema.safeParse({ code: "abc", password: "" });
    if (single.success) throw new Error("expected a failure");
    expect(formatZodErrorMessage(single.error)).toBe("Enter the password");

    const multi = unlockSchema.safeParse({ code: "", password: "" });
    if (multi.success) throw new Error("expected a failure");
    expect(multi.error.issues).toHaveLength(2);
    expect(formatZodErrorMessage(multi.error)).toBe(
      `${multi.error.issues[0].message}. Enter the password`,
    );
  });
});

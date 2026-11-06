import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

/**
 * Edge cases found while building the test suite; each one was a real bug.
 */
describe("regressions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects raw UTC offsets as timezones (Postgres inverts their sign)", async () => {
    const { resolveTimezone } = await import("@/lib/stats");
    expect(resolveTimezone("+05:30")).toBe("UTC");
    expect(resolveTimezone("-08:00")).toBe("UTC");
    expect(resolveTimezone("Asia/Kolkata")).toBe("Asia/Kolkata");
  });

  it("accepts a single flag emoji as an alias", async () => {
    const { createLinkSchema } = await import("@/lib/validators");
    expect(
      createLinkSchema.safeParse({ url: "https://example.com", customAlias: "🇺🇸" }).success,
    ).toBe(true);
  });

  it("rejects hostnames whose labels start or end with a hyphen", async () => {
    const { domainSchema } = await import("@/lib/validators");
    expect(domainSchema.safeParse({ hostname: "go.-bad.com" }).success).toBe(false);
    expect(domainSchema.safeParse({ hostname: "go.bad-.com" }).success).toBe(false);
    expect(domainSchema.safeParse({ hostname: "go.my-brand.com" }).success).toBe(true);
  });

  it("keeps BCP 47 casing for script subtags", async () => {
    const { parseLanguage } = await import("@/lib/visitor");
    expect(parseLanguage("zh-Hant-TW,zh;q=0.9")).toBe("zh-Hant-TW");
    expect(parseLanguage("en-us")).toBe("en-US");
    expect(parseLanguage("es-419")).toBe("es-419");
  });

  it("falls back to AUTH_URL when NEXT_PUBLIC_APP_URL is blank", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("AUTH_URL", "https://links.example.com");
    const { getAppOrigin } = await import("@/lib/app-url");
    expect(getAppOrigin()).toBe("https://links.example.com");
  });
});

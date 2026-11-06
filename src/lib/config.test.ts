import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "@/lib/config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("config flags", () => {
  it.each(["1", "true", "TRUE", "yes", " on "])("treats %o as on", (value) => {
    vi.stubEnv("DISABLE_REGISTRATION", value);
    expect(config.registrationDisabled).toBe(true);
  });

  it.each([undefined, "", "   ", "0", "false", "no", "off", "maybe"])(
    "treats %o as off",
    (value) => {
      vi.stubEnv("DISABLE_REGISTRATION", value);
      expect(config.registrationDisabled).toBe(false);
    },
  );

  it("reads the environment at call time", () => {
    vi.stubEnv("ALLOW_PRIVATE_NETWORK_FETCH", "true");
    expect(config.allowPrivateNetworkFetch).toBe(true);
    vi.stubEnv("ALLOW_PRIVATE_NETWORK_FETCH", "false");
    expect(config.allowPrivateNetworkFetch).toBe(false);
  });
});

describe("config lists", () => {
  it("splits, trims, lower-cases and drops empty entries", () => {
    vi.stubEnv("ALLOWED_DOMAINS", " Example.com, ,wikipedia.org ,");
    expect(config.allowedDomains).toEqual(["example.com", "wikipedia.org"]);
  });

  it.each([undefined, "", " , "])("is empty for %o", (value) => {
    vi.stubEnv("ADMIN_EMAILS", value);
    expect(config.adminEmails).toEqual([]);
  });
});

describe("config numbers", () => {
  it.each([
    [undefined, 7],
    ["10", 10],
    ["100", 16],
    ["1", 4],
    ["abc", 7],
    ["9.9", 9],
  ])("reads SHORT_CODE_LENGTH=%o as %i", (value, expected) => {
    vi.stubEnv("SHORT_CODE_LENGTH", value);
    expect(config.shortCodeLength).toBe(expected);
  });

  /* Regression: a blank value parsed as 0 and was clamped to the minimum. */
  it.each(["", "   "])("uses the default for a blank value %o", (value) => {
    vi.stubEnv("SHORT_CODE_LENGTH", value);
    vi.stubEnv("BULK_LINK_LIMIT", value);
    expect(config.shortCodeLength).toBe(7);
    expect(config.bulkLimit).toBe(100);
  });

  it.each([
    [undefined, 100],
    ["250", 250],
    ["5000", 1000],
    ["0", 1],
  ])("reads BULK_LINK_LIMIT=%o as %i", (value, expected) => {
    vi.stubEnv("BULK_LINK_LIMIT", value);
    expect(config.bulkLimit).toBe(expected);
  });
});

describe("config strings", () => {
  it.each([
    [undefined, "Linkly"],
    ["", "Linkly"],
    ["   ", "Linkly"],
    [" Shorty ", "Shorty"],
  ])("reads NEXT_PUBLIC_SITE_NAME=%o as %s", (value, expected) => {
    vi.stubEnv("NEXT_PUBLIC_SITE_NAME", value);
    expect(config.siteName).toBe(expected);
  });

  it.each([
    [undefined, "https"],
    ["http", "http"],
    [" HTTP ", "http"],
    ["https", "https"],
    ["ftp", "https"],
  ])("reads CUSTOM_DOMAIN_PROTOCOL=%o as %s", (value, expected) => {
    vi.stubEnv("CUSTOM_DOMAIN_PROTOCOL", value);
    expect(config.customDomainProtocol).toBe(expected);
  });

  it.each([
    [undefined, "none"],
    ["IP-API", "ip-api"],
    ["ipinfo", "ipinfo"],
    ["maxmind", "none"],
  ])("reads GEOLOCATION_PROVIDER=%o as %s", (value, expected) => {
    vi.stubEnv("GEOLOCATION_PROVIDER", value);
    expect(config.geolocationProvider).toBe(expected);
  });

  it("treats blank secrets as unset", () => {
    vi.stubEnv("IPINFO_TOKEN", "  ");
    vi.stubEnv("GOOGLE_SAFE_BROWSING_API_KEY", "");
    expect(config.ipinfoToken).toBeNull();
    expect(config.safeBrowsingKey).toBeNull();
    vi.stubEnv("GOOGLE_SAFE_BROWSING_API_KEY", " key ");
    expect(config.safeBrowsingKey).toBe("key");
  });
});

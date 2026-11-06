import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildShortUrl, displayShortUrl, getAppHost } from "@/lib/app-url";

/** Complements app-url.test.ts: custom domains, emoji codes and display URLs. */

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://lnk.example");
  vi.stubEnv("AUTH_URL", undefined);
  vi.stubEnv("NEXTAUTH_URL", undefined);
  vi.stubEnv("CUSTOM_DOMAIN_PROTOCOL", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function clearAppUrl() {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);
}

describe("buildShortUrl", () => {
  it("uses https on a custom domain by default", () => {
    expect(buildShortUrl("abc123", { domain: "go.brand.com" })).toBe("https://go.brand.com/abc123");
  });

  it.each([
    ["http", "http"],
    [" HTTP ", "http"],
    ["https", "https"],
    ["ftp", "https"],
  ])("honours CUSTOM_DOMAIN_PROTOCOL=%o on custom domains", (value, scheme) => {
    vi.stubEnv("CUSTOM_DOMAIN_PROTOCOL", value);
    expect(buildShortUrl("abc123", { domain: "go.brand.test" })).toBe(
      `${scheme}://go.brand.test/abc123`,
    );
  });

  it("does not apply CUSTOM_DOMAIN_PROTOCOL to the app's own domain", () => {
    vi.stubEnv("CUSTOM_DOMAIN_PROTOCOL", "http");
    expect(buildShortUrl("abc123", { domain: null })).toBe("https://lnk.example/abc123");
  });

  it.each([null, "", undefined])("falls back to the app origin for domain %o", (domain) => {
    expect(buildShortUrl("abc123", { domain })).toBe("https://lnk.example/abc123");
  });

  it("uses the request's forwarded host when no app URL is configured", () => {
    clearAppUrl();
    const request = new Request("http://10.0.0.5:3000/api/links", {
      headers: { "x-forwarded-host": "short.example", "x-forwarded-proto": "https" },
    });
    expect(buildShortUrl("abc123", { domain: "", request })).toBe("https://short.example/abc123");
    expect(buildShortUrl("abc123", request)).toBe("https://short.example/abc123");
  });

  it("prefers the custom domain over the request", () => {
    const request = new Request("https://other.example/api/links");
    expect(buildShortUrl("abc123", { domain: "go.brand.com", request })).toBe(
      "https://go.brand.com/abc123",
    );
  });

  it("falls back to localhost with nothing configured", () => {
    clearAppUrl();
    expect(buildShortUrl("abc123")).toBe("http://localhost:3000/abc123");
  });

  it.each([
    ["🚀🔥", "%F0%9F%9A%80%F0%9F%94%A5"],
    ["café", "caf%C3%A9"],
    ["a/b?c#d", "a%2Fb%3Fc%23d"],
    ["Ab3xY9z", "Ab3xY9z"],
  ])("percent-encodes the code %o", (code, encoded) => {
    expect(buildShortUrl(code)).toBe(`https://lnk.example/${encoded}`);
    expect(buildShortUrl(code, { domain: "go.brand.com" })).toBe(`https://go.brand.com/${encoded}`);
  });

  it("produces a URL whose path decodes back to the code", () => {
    const code = "🦊🍕🚀🌙";
    const url = new URL(buildShortUrl(code, { domain: "go.brand.com" }));
    expect(decodeURIComponent(url.pathname.slice(1))).toBe(code);
  });
});

describe("displayShortUrl", () => {
  it("strips the scheme and keeps the raw code", () => {
    expect(displayShortUrl("🚀🔥")).toBe("lnk.example/🚀🔥");
    expect(displayShortUrl("abc123", { domain: "go.brand.com" })).toBe("go.brand.com/abc123");
  });

  it("strips an http scheme too", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    expect(displayShortUrl("abc123")).toBe("localhost:3000/abc123");
    vi.stubEnv("CUSTOM_DOMAIN_PROTOCOL", "http");
    expect(displayShortUrl("abc123", { domain: "go.brand.test" })).toBe("go.brand.test/abc123");
  });
});

describe("getAppHost", () => {
  it("returns the configured host", () => {
    expect(getAppHost()).toBe("lnk.example");
  });

  it("keeps a non-default port", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    expect(getAppHost()).toBe("localhost:3000");
  });

  it("drops a default port", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://lnk.example:443/");
    expect(getAppHost()).toBe("lnk.example");
  });

  it("reads the request when nothing is configured", () => {
    clearAppUrl();
    const request = new Request("http://10.0.0.5:3000/", {
      headers: { "x-forwarded-host": "short.example" },
    });
    expect(getAppHost(request)).toBe("short.example");
  });

  it("falls back to AUTH_URL", () => {
    clearAppUrl();
    vi.stubEnv("AUTH_URL", "https://auth.example");
    expect(getAppHost()).toBe("auth.example");
  });

  it("falls back to localhost:3000", () => {
    clearAppUrl();
    expect(getAppHost()).toBe("localhost:3000");
  });
});

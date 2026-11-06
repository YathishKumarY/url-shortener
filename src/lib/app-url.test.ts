import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAppOrigin, buildShortUrl } from "@/lib/app-url";

const ENV_KEYS = ["NEXT_PUBLIC_APP_URL", "AUTH_URL", "NEXTAUTH_URL"] as const;

describe("getAppOrigin", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("prefers the configured public URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://links.example.com";
    const request = new Request("http://10.0.0.5:3000/api/qr/abc");
    expect(getAppOrigin(request)).toBe("https://links.example.com");
  });

  it("strips any path from the configured URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://links.example.com/some/path";
    expect(getAppOrigin()).toBe("https://links.example.com");
  });

  it("accepts a bare host and assumes https", () => {
    process.env.NEXT_PUBLIC_APP_URL = "links.example.com";
    expect(getAppOrigin()).toBe("https://links.example.com");
  });

  /*
   * Regression: the QR route used new URL(request.url).origin, which behind a
   * proxy is the internal address. The QR then encoded a URL no phone could
   * reach.
   */
  it("uses forwarded headers when no URL is configured", () => {
    const request = new Request("http://10.0.0.5:3000/api/qr/abc", {
      headers: { "x-forwarded-host": "links.example.com", "x-forwarded-proto": "https" },
    });
    expect(getAppOrigin(request)).toBe("https://links.example.com");
  });

  it("takes the first proto when the proxy sends a list", () => {
    const request = new Request("http://10.0.0.5:3000/api/qr/abc", {
      headers: { "x-forwarded-host": "links.example.com", "x-forwarded-proto": "https,http" },
    });
    expect(getAppOrigin(request)).toBe("https://links.example.com");
  });

  it("assumes http for localhost so local dev links work", () => {
    const request = new Request("http://localhost:3000/api/qr/abc", {
      headers: { "x-forwarded-host": "localhost:3000" },
    });
    expect(getAppOrigin(request)).toBe("http://localhost:3000");
  });

  it("falls back to the request origin with no config or proxy headers", () => {
    const request = new Request("https://fallback.example.com/api/qr/abc");
    expect(getAppOrigin(request)).toBe("https://fallback.example.com");
  });

  it("ignores an unparseable configured value", () => {
    process.env.NEXT_PUBLIC_APP_URL = "::::";
    const request = new Request("https://fallback.example.com/api/qr/abc");
    expect(getAppOrigin(request)).toBe("https://fallback.example.com");
  });
});

describe("buildShortUrl", () => {
  it("joins the origin and short code", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://links.example.com";
    expect(buildShortUrl("Ab3xY9z")).toBe("https://links.example.com/Ab3xY9z");
    delete process.env.NEXT_PUBLIC_APP_URL;
  });
});

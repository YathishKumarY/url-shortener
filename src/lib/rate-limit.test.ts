import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getClientIp } from "@/lib/rate-limit";

describe("getClientIp", () => {
  const saved = process.env.TRUSTED_PROXY_COUNT;

  beforeEach(() => {
    delete process.env.TRUSTED_PROXY_COUNT;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.TRUSTED_PROXY_COUNT;
    else process.env.TRUSTED_PROXY_COUNT = saved;
  });

  it("prefers platform headers that a client cannot forge", () => {
    const request = new Request("https://example.com/abc", {
      headers: { "x-real-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4" },
    });
    expect(getClientIp(request)).toBe("203.0.113.7");
  });

  it("uses cf-connecting-ip when present", () => {
    const request = new Request("https://example.com/abc", {
      headers: { "cf-connecting-ip": "203.0.113.9" },
    });
    expect(getClientIp(request)).toBe("203.0.113.9");
  });

  /*
   * Regression: taking the leftmost x-forwarded-for entry let any caller send
   * a fake address and reset their own rate limit at will. With one trusted
   * proxy the real client is the last entry, which the proxy appends.
   */
  it("ignores a client-spoofed leftmost x-forwarded-for entry", () => {
    const request = new Request("https://example.com/abc", {
      headers: { "x-forwarded-for": "1.2.3.4, 203.0.113.7" },
    });
    expect(getClientIp(request)).toBe("203.0.113.7");
  });

  it("handles a single-entry forwarded header", () => {
    const request = new Request("https://example.com/abc", {
      headers: { "x-forwarded-for": "203.0.113.7" },
    });
    expect(getClientIp(request)).toBe("203.0.113.7");
  });

  it("respects a configured proxy depth", () => {
    process.env.TRUSTED_PROXY_COUNT = "2";
    const request = new Request("https://example.com/abc", {
      headers: { "x-forwarded-for": "1.2.3.4, 203.0.113.7, 10.0.0.1" },
    });
    expect(getClientIp(request)).toBe("203.0.113.7");
  });

  it("falls back to a constant when nothing identifies the caller", () => {
    const request = new Request("https://example.com/abc");
    expect(getClientIp(request)).toBe("anonymous");
  });
});

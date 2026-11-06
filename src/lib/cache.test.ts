import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Redis is a cache in front of Postgres, not a source of truth, so an outage
 * must cost latency rather than availability.
 *
 * Regression: the redirect handler awaited `redis.get` as the first statement
 * of its try block with no guard, so when the Upstash instance disappeared
 * every short link returned 500 even though the row was still in Postgres.
 */
describe("cache helpers degrade gracefully", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("cacheGet reports a miss when Redis is unreachable", async () => {
    vi.doMock("@/lib/redis", () => ({
      redis: {
        get: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
        set: vi.fn(),
        del: vi.fn(),
      },
    }));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { cacheGet } = await import("@/lib/cache");

    await expect(cacheGet("link:abc")).resolves.toBeNull();
    expect(errSpy).toHaveBeenCalled();
  });

  it("cacheSet swallows a Redis failure", async () => {
    vi.doMock("@/lib/redis", () => ({
      redis: {
        get: vi.fn(),
        set: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
        del: vi.fn(),
      },
    }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { cacheSet } = await import("@/lib/cache");

    await expect(cacheSet("link:abc", "{}", 60)).resolves.toBeUndefined();
  });

  it("cacheDel swallows a Redis failure", async () => {
    vi.doMock("@/lib/redis", () => ({
      redis: {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
      },
    }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { cacheDel } = await import("@/lib/cache");

    await expect(cacheDel("link:abc")).resolves.toBeUndefined();
  });

  it("cacheGet passes through a hit unchanged", async () => {
    const payload = { id: "x", originalUrl: "https://example.com", expiresAt: null };
    vi.doMock("@/lib/redis", () => ({
      redis: {
        get: vi.fn().mockResolvedValue(JSON.stringify(payload)),
        set: vi.fn(),
        del: vi.fn(),
      },
    }));
    const { cacheGet } = await import("@/lib/cache");

    await expect(cacheGet("link:abc")).resolves.toBe(JSON.stringify(payload));
  });
});

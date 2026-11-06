import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Without Upstash configured, cache.ts keeps entries in process memory. These
 * complement cache.test.ts, which covers Redis outages.
 */

type CacheModule = typeof import("@/lib/cache");

async function loadCache(redis: unknown = null): Promise<CacheModule> {
  vi.doMock("@/lib/redis", () => ({ redis }));
  return import("@/lib/cache");
}

const T0 = new Date("2026-11-06T12:00:00.000Z").getTime();

beforeEach(() => {
  vi.resetModules();
  // The memory store lives on globalThis to survive hot reloads; start each test empty.
  delete (globalThis as { __linklyCache?: unknown }).__linklyCache;
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.doUnmock("@/lib/redis");
  vi.restoreAllMocks();
  delete (globalThis as { __linklyCache?: unknown }).__linklyCache;
});

describe("cache helpers without Redis", () => {
  it("misses on an unknown key", async () => {
    const { cacheGet } = await loadCache();
    await expect(cacheGet("link::abc")).resolves.toBeNull();
  });

  it("stores and returns a value", async () => {
    const { cacheGet, cacheSet } = await loadCache();
    await cacheSet("link::abc", '{"v":2}', 60);
    await expect(cacheGet("link::abc")).resolves.toBe('{"v":2}');
  });

  it("caps memory TTLs at 300 seconds", async () => {
    const { cacheGet, cacheSet } = await loadCache();
    await cacheSet("k", "v", 3600);
    vi.setSystemTime(T0 + 299_999);
    await expect(cacheGet("k")).resolves.toBe("v");
    vi.setSystemTime(T0 + 300_000);
    await expect(cacheGet("k")).resolves.toBeNull();
  });

  it("honours a TTL shorter than the cap", async () => {
    const { cacheGet, cacheSet } = await loadCache();
    await cacheSet("k", "v", 10);
    vi.setSystemTime(T0 + 9_999);
    await expect(cacheGet("k")).resolves.toBe("v");
    vi.setSystemTime(T0 + 10_000);
    await expect(cacheGet("k")).resolves.toBeNull();
  });

  it.each([0, -1, -3600])("treats a TTL of %i as a no-op", async (ttl) => {
    const { cacheGet, cacheSet } = await loadCache();
    await cacheSet("fresh", "v", ttl);
    await expect(cacheGet("fresh")).resolves.toBeNull();

    await cacheSet("existing", "kept", 60);
    await cacheSet("existing", "ignored", ttl);
    await expect(cacheGet("existing")).resolves.toBe("kept");
  });

  it("deletes several keys at once and leaves the rest", async () => {
    const { cacheDel, cacheGet, cacheSet } = await loadCache();
    await cacheSet("a", "1", 60);
    await cacheSet("b", "2", 60);
    await cacheSet("c", "3", 60);
    await cacheDel("a", "b", "missing");
    await expect(cacheGet("a")).resolves.toBeNull();
    await expect(cacheGet("b")).resolves.toBeNull();
    await expect(cacheGet("c")).resolves.toBe("3");
  });

  it("treats a delete with no keys as a no-op", async () => {
    const { cacheDel, cacheGet, cacheSet } = await loadCache();
    await cacheSet("a", "1", 60);
    await expect(cacheDel()).resolves.toBeUndefined();
    await expect(cacheGet("a")).resolves.toBe("1");
  });

  it("keeps entries across a module reload, as after a dev-server hot reload", async () => {
    const first = await loadCache();
    await first.cacheSet("k", "v", 60);
    vi.resetModules();
    const second = await loadCache();
    await expect(second.cacheGet("k")).resolves.toBe("v");
  });
});

describe("cache helpers with Redis", () => {
  function fakeRedis() {
    return {
      get: vi.fn().mockResolvedValue("from-redis"),
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
    };
  }

  it("passes the full TTL to Redis without the memory cap", async () => {
    const redis = fakeRedis();
    const { cacheSet } = await loadCache(redis);
    await cacheSet("k", "v", 3600);
    expect(redis.set).toHaveBeenCalledWith("k", "v", { ex: 3600 });
  });

  it("never sends a non-positive TTL to Redis", async () => {
    const redis = fakeRedis();
    const { cacheSet } = await loadCache(redis);
    await cacheSet("k", "v", 0);
    await cacheSet("k", "v", -5);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("reads from Redis instead of memory", async () => {
    const redis = fakeRedis();
    const { cacheGet } = await loadCache(redis);
    await expect(cacheGet("k")).resolves.toBe("from-redis");
    expect(redis.get).toHaveBeenCalledWith("k");
  });

  it("deletes all keys in one call and skips an empty delete", async () => {
    const redis = fakeRedis();
    const { cacheDel } = await loadCache(redis);
    await cacheDel();
    expect(redis.del).not.toHaveBeenCalled();
    await cacheDel("a", "b");
    expect(redis.del).toHaveBeenCalledWith("a", "b");
  });
});

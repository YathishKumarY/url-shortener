import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryCache, MemoryRateLimiter, parseWindow } from "@/lib/memory-store";

const T0 = new Date("2026-11-06T12:00:00.000Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("MemoryCache", () => {
  it("misses on an unknown key", () => {
    expect(new MemoryCache().get("nope")).toBeNull();
  });

  it("returns stored values, including falsy ones and object identity", () => {
    const cache = new MemoryCache();
    const object = { id: 1 };
    cache.set("object", object, 60);
    cache.set("zero", 0, 60);
    cache.set("empty", "", 60);
    cache.set("false", false, 60);
    expect(cache.get("object")).toBe(object);
    expect(cache.get("zero")).toBe(0);
    expect(cache.get("empty")).toBe("");
    expect(cache.get("false")).toBe(false);
  });

  it("expires an entry exactly at its TTL", () => {
    const cache = new MemoryCache();
    cache.set("k", "v", 10);
    vi.advanceTimersByTime(9_999);
    expect(cache.get("k")).toBe("v");
    vi.advanceTimersByTime(1);
    expect(cache.get("k")).toBeNull();
  });

  it("drops an expired entry when it is read", () => {
    const cache = new MemoryCache();
    cache.set("k", "v", 1);
    expect(cache.size).toBe(1);
    vi.setSystemTime(T0 + 5_000);
    expect(cache.get("k")).toBeNull();
    expect(cache.size).toBe(0);
  });

  it("resets the value and TTL when a key is overwritten", () => {
    const cache = new MemoryCache();
    cache.set("k", "old", 10);
    vi.advanceTimersByTime(8_000);
    cache.set("k", "new", 10);
    vi.advanceTimersByTime(8_000);
    expect(cache.get("k")).toBe("new");
    expect(cache.size).toBe(1);
  });

  it("deletes entries", () => {
    const cache = new MemoryCache();
    cache.set("a", 1, 60);
    cache.set("b", 2, 60);
    cache.delete("a");
    cache.delete("missing");
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBe(2);
    expect(cache.size).toBe(1);
  });

  it("evicts the least recently inserted entry beyond maxEntries", () => {
    const cache = new MemoryCache(3);
    for (const key of ["a", "b", "c", "d"]) cache.set(key, key, 60);
    expect(cache.size).toBe(3);
    expect(cache.get("a")).toBeNull();
    expect([cache.get("b"), cache.get("c"), cache.get("d")]).toEqual(["b", "c", "d"]);
  });

  it("refreshes recency on get", () => {
    const cache = new MemoryCache(3);
    for (const key of ["a", "b", "c"]) cache.set(key, key, 60);
    cache.get("a");
    cache.set("d", "d", 60);
    expect(cache.get("a")).toBe("a");
    expect(cache.get("b")).toBeNull();
  });

  it("refreshes recency on overwrite", () => {
    const cache = new MemoryCache(3);
    for (const key of ["a", "b", "c"]) cache.set(key, key, 60);
    cache.set("a", "a2", 60);
    cache.set("d", "d", 60);
    expect(cache.get("a")).toBe("a2");
    expect(cache.get("b")).toBeNull();
  });

  it("keeps only the newest entry with maxEntries 1", () => {
    const cache = new MemoryCache(1);
    cache.set("a", 1, 60);
    cache.set("b", 2, 60);
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBe(2);
  });

  it("bounds the default cache at 10,000 entries", () => {
    const cache = new MemoryCache();
    for (let i = 0; i <= 10_000; i++) cache.set(`k${i}`, i, 60);
    expect(cache.size).toBe(10_000);
    expect(cache.get("k0")).toBeNull();
    expect(cache.get("k10000")).toBe(10_000);
  });
});

describe("MemoryRateLimiter", () => {
  const WINDOW = 60_000;

  it("allows up to max requests, then blocks", async () => {
    const limiter = new MemoryRateLimiter(3, WINDOW);
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await limiter.limit("ip"));
    expect(results.map((r) => r.success)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);
    expect(results.every((r) => r.limit === 3)).toBe(true);
  });

  it("returns the Upstash result shape", async () => {
    const result = await new MemoryRateLimiter(5, WINDOW).limit("ip");
    expect(result).toEqual({ success: true, limit: 5, remaining: 4, reset: T0 + WINDOW });
  });

  it("resets when the oldest hit in the window expires", async () => {
    const limiter = new MemoryRateLimiter(3, WINDOW);
    await limiter.limit("ip");
    vi.setSystemTime(T0 + 10_000);
    await limiter.limit("ip");
    vi.setSystemTime(T0 + 20_000);
    await limiter.limit("ip");
    vi.setSystemTime(T0 + 30_000);
    const blocked = await limiter.limit("ip");
    expect(blocked.success).toBe(false);
    expect(blocked.reset).toBe(T0 + WINDOW);
  });

  it("slides the window to free capacity one hit at a time", async () => {
    const limiter = new MemoryRateLimiter(3, WINDOW);
    for (const offset of [0, 10_000, 20_000]) {
      vi.setSystemTime(T0 + offset);
      await limiter.limit("ip");
    }

    vi.setSystemTime(T0 + WINDOW - 1);
    expect((await limiter.limit("ip")).success).toBe(false);

    vi.setSystemTime(T0 + WINDOW);
    const freed = await limiter.limit("ip");
    expect(freed).toMatchObject({ success: true, remaining: 0, reset: T0 + 10_000 + WINDOW });

    vi.setSystemTime(T0 + WINDOW + 5_000);
    expect((await limiter.limit("ip")).success).toBe(false);

    vi.setSystemTime(T0 + 10_000 + WINDOW);
    expect((await limiter.limit("ip")).success).toBe(true);
  });

  it("does not let rejected requests extend the block", async () => {
    const limiter = new MemoryRateLimiter(1, WINDOW);
    await limiter.limit("ip");
    for (let s = 1; s < 60; s += 5) {
      vi.setSystemTime(T0 + s * 1000);
      expect((await limiter.limit("ip")).success).toBe(false);
    }
    vi.setSystemTime(T0 + WINDOW);
    expect((await limiter.limit("ip")).success).toBe(true);
  });

  it("counts keys independently", async () => {
    const limiter = new MemoryRateLimiter(1, WINDOW);
    expect((await limiter.limit("a")).success).toBe(true);
    expect((await limiter.limit("a")).success).toBe(false);
    expect((await limiter.limit("b")).success).toBe(true);
  });

  it("evicts the least recently seen key beyond maxKeys", async () => {
    const limiter = new MemoryRateLimiter(1, WINDOW, 2);
    await limiter.limit("a");
    await limiter.limit("b");
    await limiter.limit("c");
    // "a" was evicted, so its history is gone and it gets a fresh allowance.
    expect((await limiter.limit("a")).success).toBe(true);
  });

  it("treats a rejected request as recent use for eviction", async () => {
    const limiter = new MemoryRateLimiter(1, WINDOW, 2);
    await limiter.limit("a");
    await limiter.limit("b");
    expect((await limiter.limit("a")).success).toBe(false);
    await limiter.limit("c");
    expect((await limiter.limit("a")).success).toBe(false);
    expect((await limiter.limit("b")).success).toBe(true);
  });
});

describe("parseWindow", () => {
  it.each([
    ["10 s", 10_000],
    ["1 m", 60_000],
    ["5m", 300_000],
    ["2 h", 7_200_000],
    ["1 d", 86_400_000],
    ["250 ms", 250],
    ["  3 s  ", 3_000],
    ["90s", 90_000],
  ])("parses %o as %i ms", (window, expected) => {
    expect(parseWindow(window)).toBe(expected);
  });

  it.each(["", "10", "s", "1.5 m", "-1 m", "10 sec", "1 w", "m 1", "1 M", "1 m 2 s"])(
    "rejects %o",
    (window) => {
      expect(() => parseWindow(window)).toThrow(`Invalid rate limit window: ${window}`);
    },
  );
});

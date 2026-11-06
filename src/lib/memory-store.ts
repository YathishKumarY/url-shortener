/**
 * In-process stand-ins for Redis, used when Upstash is not configured.
 *
 * Both are bounded so a flood of distinct keys (one per visitor IP, say)
 * cannot grow memory without limit: the oldest entries are evicted first.
 */

interface Entry {
  value: unknown;
  expiresAt: number;
}

export class MemoryCache {
  private store = new Map<string, Entry>();

  constructor(private readonly maxEntries = 10_000) {}

  get(key: string): unknown {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    // Re-insert so Map iteration order doubles as least-recently-used order.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: unknown, ttlSeconds: number): void {
    this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  get size(): number {
    return this.store.size;
  }
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the window frees up again. */
  reset: number;
}

/** Sliding-window limiter with the same result shape as @upstash/ratelimit. */
export class MemoryRateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly maxKeys = 50_000,
  ) {}

  async limit(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = (this.hits.get(key) ?? []).filter((t) => t > windowStart);
    const success = timestamps.length < this.max;
    if (success) timestamps.push(now);

    this.hits.delete(key);
    this.hits.set(key, timestamps);
    while (this.hits.size > this.maxKeys) {
      const oldest = this.hits.keys().next().value;
      if (oldest === undefined) break;
      this.hits.delete(oldest);
    }

    return {
      success,
      limit: this.max,
      remaining: Math.max(0, this.max - timestamps.length),
      reset: (timestamps[0] ?? now) + this.windowMs,
    };
  }
}

/** Parse "10 s", "1 m", "5m", "2 h" into milliseconds. */
export function parseWindow(window: string): number {
  const match = /^\s*(\d+)\s*(ms|s|m|h|d)\s*$/.exec(window);
  if (!match) throw new Error(`Invalid rate limit window: ${window}`);
  const value = Number(match[1]);
  const unit = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as "ms"];
  return value * unit;
}

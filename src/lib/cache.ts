import { MemoryCache } from "@/lib/memory-store";
import { redis } from "@/lib/redis";

/**
 * Fail-soft cache in front of Postgres.
 *
 * Redis is only a cache here - Postgres is the source of truth - so an outage
 * must degrade latency, not availability. The redirect handler once awaited
 * `redis.get` unguarded, so when the Upstash instance went away every short
 * link returned a 500. These helpers swallow transport errors and report a
 * miss instead.
 *
 * Without Redis configured, entries live in process memory. TTLs are capped
 * there because an edit on one instance cannot invalidate another instance's
 * memory, so a stale entry must not outlive a few minutes.
 */

const MEMORY_TTL_CAP_SECONDS = 300;

const globalForCache = globalThis as unknown as { __linklyCache?: MemoryCache };
const memory = (globalForCache.__linklyCache ??= new MemoryCache());

export async function cacheGet(key: string): Promise<unknown> {
  if (!redis) return memory.get(key);
  try {
    return await redis.get<unknown>(key);
  } catch (err) {
    console.error("[cache] get failed, serving from database:", err);
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (ttlSeconds <= 0) return;
  if (!redis) {
    memory.set(key, value, Math.min(ttlSeconds, MEMORY_TTL_CAP_SECONDS));
    return;
  }
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (err) {
    console.error("[cache] set failed, continuing without cache:", err);
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  if (!redis) {
    for (const key of keys) memory.delete(key);
    return;
  }
  try {
    await redis.del(...keys);
  } catch (err) {
    console.error("[cache] delete failed:", err);
  }
}

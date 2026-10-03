import { redis } from "@/lib/redis";

/**
 * Fail-soft wrappers around the Redis cache.
 *
 * Redis is only a cache here - Postgres is the source of truth - so an
 * outage must degrade latency, not availability. The redirect handler
 * previously awaited `redis.get` as the first statement inside its try block,
 * so when the Upstash instance went away every single short link returned a
 * 500 even though the row was sitting in the database. These helpers swallow
 * transport errors and report a miss instead.
 */

export async function cacheGet(key: string): Promise<unknown> {
  try {
    return await redis.get<unknown>(key);
  } catch (err) {
    console.error("[cache] get failed, serving from database:", err);
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (err) {
    console.error("[cache] set failed, continuing without cache:", err);
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    console.error("[cache] delete failed:", err);
  }
}

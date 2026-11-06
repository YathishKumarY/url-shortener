import { Redis } from "@upstash/redis";

/**
 * Upstash client, or `null` when Redis is not configured.
 *
 * Redis is optional. Without it the cache and rate limiters fall back to
 * process memory, which is fine for a single self-hosted instance. Previously
 * the client was always constructed with `undefined` credentials, so every
 * call threw, and the rate limiters - which fail open on errors - silently
 * stopped limiting anything.
 */
function createRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export const redis = createRedis();

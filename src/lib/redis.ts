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
  return new Redis({
    url,
    token,
    // Every caller treats Redis as optional and falls back on errors, so a
    // slow failure is worse than a fast one. The client's default of five
    // retries with exponential backoff spent about 4 seconds per command when
    // the database was unreachable, and a redirect makes three commands.
    retry: { retries: 1, backoff: () => 100 },
    signal: () => AbortSignal.timeout(REDIS_TIMEOUT_MS),
  });
}

/** Give up on a Redis command after this long and use the fallback. */
const REDIS_TIMEOUT_MS = 1500;

export const redis = createRedis();

import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { MemoryRateLimiter, parseWindow, type RateLimitResult } from "@/lib/memory-store";
import { redis } from "@/lib/redis";

export type { RateLimitResult } from "@/lib/memory-store";

export interface Limiter {
  limit(key: string): Promise<RateLimitResult>;
}

type Window = `${number} ${"s" | "m" | "h"}`;

/**
 * Upstash limiter when Redis is configured, otherwise an in-process one.
 * Memory limiters are kept on globalThis so dev-server hot reloads do not
 * reset every counter.
 */
function createLimiter(name: string, max: number, window: Window): Limiter {
  if (redis) {
    const upstash = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, window),
      prefix: `ratelimit:${name}`,
    });
    return {
      async limit(key) {
        const { success, limit, remaining, reset } = await upstash.limit(key);
        return { success, limit, remaining, reset };
      },
    };
  }

  const g = globalThis as unknown as { __linklyLimiters?: Map<string, MemoryRateLimiter> };
  g.__linklyLimiters ??= new Map();
  let limiter = g.__linklyLimiters.get(name);
  if (!limiter) {
    limiter = new MemoryRateLimiter(max, parseWindow(window));
    g.__linklyLimiters.set(name, limiter);
  }
  return limiter;
}

/** Positive integer from the environment, or the fallback. */
function perMinute(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
}

/** Anonymous link creation, per IP. */
export const createLinkLimiter = createLimiter(
  "create",
  perMinute("RATE_LIMIT_ANON_CREATE", 10),
  "1 m",
);
/** Signed-in link creation and API writes, per user. */
export const userWriteLimiter = createLimiter("user-write", 120, "1 m");
/**
 * Redirects, per IP. Generous by default: behind a corporate NAT or carrier
 * CGNAT hundreds of real people share one address, and a link shared in a
 * company chat must not start returning 429s.
 */
export const redirectLimiter = createLimiter(
  "redirect",
  perMinute("RATE_LIMIT_REDIRECTS", 600),
  "1 m",
);
/** Registration and password reset are brute-force targets. */
export const authLimiter = createLimiter("auth", 5, "5 m");
/** Credential sign-in attempts, per email + IP. */
export const signInLimiter = createLimiter("signin", 10, "5 m");
/** Public API reads, per key or user. */
export const apiLimiter = createLimiter("api", 300, "1 m");
/** Password attempts on protected links, per IP + link. */
export const unlockLimiter = createLimiter("unlock", 10, "5 m");
/** Server-side page metadata fetches, per user. */
export const metadataLimiter = createLimiter("metadata", 30, "1 m");
/** Abuse reports, per IP. */
export const reportLimiter = createLimiter("report", 5, "1 h");

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
  };
}

/**
 * Run a limiter and turn a rejection into a 429 response.
 *
 * Fails open: if the limiter itself errors (Upstash unreachable) the request
 * proceeds, because a cache outage should not take the product down.
 */
export async function enforceRateLimit(
  limiter: Limiter,
  key: string,
  message = "Too many requests. Please try again later.",
): Promise<{ ok: true; headers: Record<string, string> } | { ok: false; response: NextResponse }> {
  try {
    const result = await limiter.limit(key);
    const headers = rateLimitHeaders(result);
    if (!result.success) {
      const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
      return {
        ok: false,
        response: NextResponse.json(
          { error: message },
          { status: 429, headers: { ...headers, "Retry-After": String(retryAfter) } },
        ),
      };
    }
    return { ok: true, headers };
  } catch (err) {
    console.error("[rate-limit] check failed, allowing request:", err);
    return { ok: true, headers: {} };
  }
}

/**
 * Number of proxies in front of the app, counted from the client.
 *
 * `x-forwarded-for` is a client-appendable list: a caller can send
 * `X-Forwarded-For: 1.2.3.4` and the proxy appends the real address, so the
 * *leftmost* entry is attacker-controlled and taking it lets anyone reset
 * their own rate limit at will. The trustworthy entry is the one the nearest
 * trusted proxy wrote, counted from the right.
 *
 * Defaults to 1 (a single proxy, e.g. Vercel's edge). Raise it if you add
 * another proxy layer in front. Read per call so the value stays configurable
 * at runtime rather than frozen at module load.
 */
function trustedProxyCount(): number {
  const parsed = Number(process.env.TRUSTED_PROXY_COUNT ?? "1");
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

export function getClientIp(request: Request): string {
  // Platform-provided headers are set by infrastructure and cannot be spoofed
  // by the client, so prefer them.
  const platformIp =
    request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? null;
  if (platformIp?.trim()) return platformIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (hops.length > 0) {
      const index = Math.max(0, hops.length - trustedProxyCount());
      return hops[index];
    }
  }

  return "anonymous";
}

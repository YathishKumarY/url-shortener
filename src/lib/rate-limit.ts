import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";

export const createLinkLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "ratelimit:create",
});

export const redirectLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  prefix: "ratelimit:redirect",
});

/** Sign-in, registration, and password reset are brute-force targets. */
export const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "5 m"),
  prefix: "ratelimit:auth",
});

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

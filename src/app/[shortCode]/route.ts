import { NextResponse, after } from "next/server";
import { recordClick } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { redirectLimiter, getClientIp } from "@/lib/rate-limit";
import { redis } from "@/lib/redis";

/** Value stored in Redis so the cached path can honour expiry without a DB read. */
interface CachedLink {
  id: string;
  originalUrl: string;
  /** Epoch ms, or null when the link never expires. */
  expiresAt: number | null;
}

const CACHE_TTL_SECONDS = 86400;

function parseCached(value: unknown): CachedLink | null {
  if (!value) return null;
  // Entries written by an older build were bare URL strings; treat them as a
  // miss so they are rewritten in the new shape instead of skipping expiry.
  const raw = typeof value === "string" ? safeParse(value) : value;
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<CachedLink>;
  if (typeof candidate.id !== "string" || typeof candidate.originalUrl !== "string") return null;
  const expiresAt =
    typeof candidate.expiresAt === "number" || candidate.expiresAt === null
      ? candidate.expiresAt
      : null;
  return { id: candidate.id, originalUrl: candidate.originalUrl, expiresAt };
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function GET(request: Request, ctx: RouteContext<"/[shortCode]">) {
  const { shortCode } = await ctx.params;

  if (!shortCode || shortCode.length > 30) {
    return NextResponse.json({ error: "Invalid short code" }, { status: 400 });
  }

  const ip = getClientIp(request);
  let rateLimitHeaders: Record<string, string> = {};
  try {
    const { success, limit, remaining, reset } = await redirectLimiter.limit(ip);
    rateLimitHeaders = {
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(reset),
    };
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: rateLimitHeaders,
        },
      );
    }
  } catch (err) {
    console.error("[redirect] Rate limit check failed:", err);
  }

  try {
    const cacheKey = `link:${shortCode}`;
    const cached = parseCached(await redis.get<unknown>(cacheKey));

    if (cached) {
      // The cache carries expiresAt precisely so an expired link cannot be
      // served from it for up to a day after it lapses.
      if (cached.expiresAt !== null && cached.expiresAt <= Date.now()) {
        await redis.del(cacheKey).catch((err) => {
          console.error("[redirect] Redis delete failed:", err);
        });
        return expiredResponse(shortCode, request);
      }

      after(async () => {
        try {
          await recordClick({ linkId: cached.id, request });
        } catch (err) {
          console.error("[redirect] Click recording failed:", err);
        }
      });
      return NextResponse.redirect(cached.originalUrl, 302);
    }

    const link = await prisma.link.findUnique({ where: { shortCode } });

    if (!link) {
      return notFoundResponse(shortCode, request);
    }

    if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) {
      await redis.del(cacheKey).catch((err) => {
        console.error("[redirect] Redis delete failed:", err);
      });
      return expiredResponse(shortCode, request);
    }

    const payload: CachedLink = {
      id: link.id,
      originalUrl: link.originalUrl,
      expiresAt: link.expiresAt ? new Date(link.expiresAt).getTime() : null,
    };
    // Never cache past the expiry instant.
    const ttl = payload.expiresAt
      ? Math.min(CACHE_TTL_SECONDS, Math.ceil((payload.expiresAt - Date.now()) / 1000))
      : CACHE_TTL_SECONDS;
    if (ttl > 0) {
      await redis.set(cacheKey, JSON.stringify(payload), { ex: ttl }).catch((err) => {
        console.error("[redirect] Redis cache set failed:", err);
      });
    }

    after(async () => {
      try {
        await recordClick({ linkId: link.id, request });
      } catch (err) {
        console.error("[redirect] Click recording failed:", err);
      }
    });

    return NextResponse.redirect(link.originalUrl, 302);
  } catch (error) {
    console.error("[redirect] Failed to process redirect:", error);
    return NextResponse.json(
      { error: "Failed to process redirect. Please try again." },
      { status: 500 },
    );
  }
}

/**
 * Send visitors to a real, routable notice page.
 *
 * `not-found.tsx` is an App Router convention file, not a URL: it compiles to
 * the internal `_not-found` entry, so `/not-found` has no static route and
 * falls through to this very `/[shortCode]` handler. Redirecting there looked
 * up a link named "not-found", missed, and redirected again - an infinite 302
 * loop ending in ERR_TOO_MANY_REDIRECTS.
 *
 * `/link-missing` and `/link-expired` are real pages. Static routes take
 * precedence over the dynamic `[shortCode]` segment, so these resolve to the
 * notice pages and the loop cannot recur.
 */
function notFoundResponse(shortCode: string, request: Request) {
  return noticeRedirect("/link-missing", shortCode, request);
}

function expiredResponse(shortCode: string, request: Request) {
  return noticeRedirect("/link-expired", shortCode, request);
}

function noticeRedirect(path: string, shortCode: string, request: Request) {
  const target = new URL(path, request.url);
  target.searchParams.set("code", shortCode);
  const response = NextResponse.redirect(target, 302);
  // Never let a browser or CDN cache the "missing" verdict: the owner may
  // create or renew that short code at any time.
  response.headers.set("Cache-Control", "no-store");
  return response;
}

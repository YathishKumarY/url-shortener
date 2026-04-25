import { NextResponse, after } from "next/server";
import { recordClick } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { redirectLimiter, getClientIp } from "@/lib/rate-limit";
import { redis } from "@/lib/redis";

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
    const cached = await redis.get<string>(`link:${shortCode}`);
    if (cached) {
      after(async () => {
        try {
          const link = await prisma.link.findUnique({
            where: { shortCode },
            select: { id: true },
          });
          if (link) await recordClick({ linkId: link.id, request });
        } catch (err) {
          console.error("[redirect] Click recording failed:", err);
        }
      });
      return NextResponse.redirect(cached, 302);
    }

    const link = await prisma.link.findUnique({ where: { shortCode } });

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      await redis.del(`link:${shortCode}`).catch((err) => {
        console.error("[redirect] Redis delete failed:", err);
      });
      return NextResponse.json({ error: "This link has expired" }, { status: 410 });
    }

    await redis.set(`link:${shortCode}`, link.originalUrl, { ex: 86400 }).catch((err) => {
      console.error("[redirect] Redis cache set failed:", err);
    });

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

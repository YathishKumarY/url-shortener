import { NextResponse } from "next/server";
import { jsonError, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { apiLimiter, enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { getStats } from "@/lib/stats";
import { statsQuerySchema } from "@/lib/validators";

function decodeCode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Analytics for a link whose owner made its stats public (like spoo.me's
 * /stats/<alias> or Bitly's "+" pages). Private links answer 404 so their
 * existence is not confirmed.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/public/stats/[code]">) {
  const limit = await enforceRateLimit(apiLimiter, `public-stats:${getClientIp(request)}`);
  if (!limit.ok) return limit.response;

  const code = decodeCode((await ctx.params).code);
  const { searchParams } = new URL(request.url);
  const domain = (searchParams.get("domain") ?? "").trim().toLowerCase();
  const parsed = statsQuerySchema.safeParse({
    period: searchParams.get("period") ?? undefined,
    tz: searchParams.get("tz") ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);

  const link = await prisma.link.findUnique({
    where: { domain_shortCode: { domain, shortCode: code } },
    select: { id: true, publicStats: true, bannedAt: true },
  });
  if (!link || !link.publicStats || link.bannedAt) {
    return jsonError("Stats for this link are not public", 404);
  }

  const stats = await getStats({
    scope: { linkId: link.id },
    period: parsed.data.period,
    timezone: parsed.data.tz,
  });
  return NextResponse.json(stats, { headers: { "Cache-Control": "public, max-age=30" } });
}

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { jsonError, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getStats } from "@/lib/stats";
import { statsQuerySchema } from "@/lib/validators";

/** Account-wide analytics across all of the caller's links. */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const parsed = statsQuerySchema.safeParse({
    period: searchParams.get("period") ?? undefined,
    tz: searchParams.get("tz") ?? undefined,
    includeBots: searchParams.get("includeBots") ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);

  try {
    const [stats, totalLinks, activeLinks] = await Promise.all([
      getStats({
        scope: { userId: auth.user.id },
        period: parsed.data.period,
        timezone: parsed.data.tz,
        includeBots: parsed.data.includeBots,
      }),
      prisma.link.count({ where: { userId: auth.user.id } }),
      prisma.link.count({
        where: {
          userId: auth.user.id,
          disabled: false,
          archived: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      }),
    ]);
    return NextResponse.json({ ...stats, totalLinks, activeLinks });
  } catch (error) {
    console.error("[stats] Failed to fetch account analytics:", error);
    return jsonError("Failed to fetch analytics. Please try again.", 500);
  }
}

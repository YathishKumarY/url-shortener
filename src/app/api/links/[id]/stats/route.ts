import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { jsonError, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getStats } from "@/lib/stats";
import { statsQuerySchema } from "@/lib/validators";

export async function GET(request: Request, ctx: RouteContext<"/api/links/[id]/stats">) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const { searchParams } = new URL(request.url);
  const parsed = statsQuerySchema.safeParse({
    period: searchParams.get("period") ?? undefined,
    tz: searchParams.get("tz") ?? undefined,
    includeBots: searchParams.get("includeBots") ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);

  try {
    const link = await prisma.link.findFirst({
      where: { id, userId: auth.user.id },
      select: { id: true },
    });
    if (!link) return jsonError("Link not found", 404);

    const stats = await getStats({
      scope: { linkId: id },
      period: parsed.data.period,
      timezone: parsed.data.tz,
      includeBots: parsed.data.includeBots,
    });
    return NextResponse.json(stats);
  } catch (error) {
    console.error("[stats] Failed to fetch analytics:", error);
    return jsonError("Failed to fetch analytics. Please try again.", 500);
  }
}

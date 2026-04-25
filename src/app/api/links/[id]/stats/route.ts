import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { statsQuerySchema } from "@/lib/validators";

export async function GET(request: Request, ctx: RouteContext<"/api/links/[id]/stats">) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const { searchParams } = new URL(request.url);

  const parsed = statsQuerySchema.safeParse({
    period: searchParams.get("period") ?? "7d",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { period } = parsed.data;

  try {
    const link = await prisma.link.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    const now = new Date();
    let since: Date;
    switch (period) {
      case "24h":
        since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        since = new Date(0);
    }

    const whereClause = { linkId: id, timestamp: { gte: since } };

    const [
      totalClicks,
      uniqueVisitorResult,
      clicksByDate,
      referrerGroups,
      deviceGroups,
      browserGroups,
      countryGroups,
    ] = await Promise.all([
      prisma.click.count({ where: whereClause }),

      prisma.click.findMany({
        where: { ...whereClause, ipHash: { not: null } },
        select: { ipHash: true },
        distinct: ["ipHash"],
      }),

      prisma.click.groupBy({
        by: ["timestamp"],
        where: whereClause,
        _count: true,
        orderBy: { timestamp: "asc" },
      }),

      prisma.click.groupBy({
        by: ["referrer"],
        where: whereClause,
        _count: true,
        orderBy: { _count: { referrer: "desc" } },
        take: 10,
      }),

      prisma.click.groupBy({
        by: ["device"],
        where: whereClause,
        _count: true,
        orderBy: { _count: { device: "desc" } },
        take: 10,
      }),

      prisma.click.groupBy({
        by: ["browser"],
        where: whereClause,
        _count: true,
        orderBy: { _count: { browser: "desc" } },
        take: 10,
      }),

      prisma.click.groupBy({
        by: ["country"],
        where: whereClause,
        _count: true,
        orderBy: { _count: { country: "desc" } },
        take: 10,
      }),
    ]);

    const dateMap = new Map<string, number>();
    for (const row of clicksByDate) {
      const date = row.timestamp.toISOString().split("T")[0];
      dateMap.set(date, (dateMap.get(date) ?? 0) + row._count);
    }
    const clicksOverTime = Array.from(dateMap.entries())
      .map(([date, clicks]) => ({ date, clicks }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      clicksOverTime,
      topReferrers: referrerGroups.map((r) => ({
        referrer: r.referrer ?? "Direct",
        clicks: r._count,
      })),
      devices: deviceGroups.map((d) => ({
        device: d.device ?? "Unknown",
        clicks: d._count,
      })),
      browsers: browserGroups.map((b) => ({
        browser: b.browser ?? "Unknown",
        clicks: b._count,
      })),
      countries: countryGroups.map((c) => ({
        country: c.country ?? "Unknown",
        clicks: c._count,
      })),
      totalClicks,
      uniqueVisitors: uniqueVisitorResult.length,
    });
  } catch (error) {
    console.error("[stats] Failed to fetch analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics. Please try again." },
      { status: 500 },
    );
  }
}

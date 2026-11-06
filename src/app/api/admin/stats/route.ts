import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getStats } from "@/lib/stats";

/** Instance-wide numbers for the admin overview. */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const dayAgo = new Date(Date.now() - 86_400_000);
  const [
    users,
    bannedUsers,
    links,
    bannedLinks,
    anonymousLinks,
    clicks,
    clicks24h,
    openReports,
    newUsers24h,
    stats,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { bannedAt: { not: null } } }),
    prisma.link.count(),
    prisma.link.count({ where: { bannedAt: { not: null } } }),
    prisma.link.count({ where: { userId: null } }),
    prisma.click.count({ where: { isBot: false } }),
    prisma.click.count({ where: { isBot: false, timestamp: { gte: dayAgo } } }),
    prisma.report.count({ where: { resolved: false } }),
    prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
    getStats({ scope: { all: true }, period: "30d" }),
  ]);

  return NextResponse.json({
    users,
    bannedUsers,
    newUsers24h,
    links,
    bannedLinks,
    anonymousLinks,
    clicks,
    clicks24h,
    openReports,
    timeseries: stats.timeseries,
    topLinks: stats.topLinks,
    countries: stats.countries.slice(0, 10),
  });
}

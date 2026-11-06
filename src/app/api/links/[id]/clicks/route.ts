import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { toCsv } from "@/lib/csv";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const EXPORT_LIMIT = 50_000;

/**
 * Raw click log for one link. `format=csv|json` returns a download with up to
 * 50k rows (spoo.me-style export); without it, the latest 100 as JSON for
 * the dashboard's activity table.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/links/[id]/clicks">) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const format = new URL(request.url).searchParams.get("format");

  const link = await prisma.link.findFirst({
    where: { id, userId: auth.user.id },
    select: { id: true, shortCode: true },
  });
  if (!link) return jsonError("Link not found", 404);

  const clicks = await prisma.click.findMany({
    where: { linkId: id },
    orderBy: { timestamp: "desc" },
    take: format ? EXPORT_LIMIT : 100,
    select: {
      timestamp: true,
      source: true,
      destination: true,
      referrer: true,
      referrerHost: true,
      country: true,
      region: true,
      city: true,
      device: true,
      browser: true,
      os: true,
      language: true,
      isBot: true,
    },
  });

  const filename = `${encodeURIComponent(link.shortCode)}-clicks`;
  if (format === "csv") {
    const csv = toCsv(clicks, [
      "timestamp",
      "source",
      "destination",
      "referrer",
      "referrerHost",
      "country",
      "region",
      "city",
      "device",
      "browser",
      "os",
      "language",
      "isBot",
    ]);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }
  if (format === "json") {
    return new NextResponse(JSON.stringify(clicks, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}.json"`,
      },
    });
  }
  return NextResponse.json({ clicks });
}

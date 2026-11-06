import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { buildShortUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const resolved = new URL(request.url).searchParams.get("resolved") === "true";
  const reports = await prisma.report.findMany({
    where: { resolved },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      link: {
        select: {
          id: true,
          shortCode: true,
          domain: true,
          originalUrl: true,
          bannedAt: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  return NextResponse.json(
    reports.map((r) => ({
      ...r,
      link: {
        ...r.link,
        shortUrl: buildShortUrl(r.link.shortCode, { domain: r.link.domain || null, request }),
      },
    })),
  );
}

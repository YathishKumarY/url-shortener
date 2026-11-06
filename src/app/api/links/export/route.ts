import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { toCsv } from "@/lib/csv";
import { linkInclude, serializeLink } from "@/lib/links";
import { prisma } from "@/lib/prisma";

const EXPORT_LIMIT = 10_000;

/** Download every link as CSV (spreadsheet-friendly) or JSON (re-importable). */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const format = new URL(request.url).searchParams.get("format") === "json" ? "json" : "csv";

  const links = await prisma.link.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
    take: EXPORT_LIMIT,
    include: linkInclude,
  });
  const serialized = links.map((link) => serializeLink(link, request));
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    return new NextResponse(JSON.stringify(serialized, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="links-${stamp}.json"`,
      },
    });
  }

  const rows = serialized.map((link) => ({
    shortUrl: link.shortUrl,
    url: link.originalUrl,
    alias: link.shortCode,
    domain: link.domain ?? "",
    title: link.title ?? "",
    description: link.description ?? "",
    tags: link.tags.map((t) => t.name).join("|"),
    clicks: link.clickCount,
    status: link.status,
    passwordProtected: link.hasPassword,
    maxClicks: link.maxClicks ?? "",
    expiresAt: link.expiresAt ?? "",
    createdAt: link.createdAt,
  }));
  const csv = toCsv(rows, [
    "shortUrl",
    "url",
    "alias",
    "domain",
    "title",
    "description",
    "tags",
    "clicks",
    "status",
    "passwordProtected",
    "maxClicks",
    "expiresAt",
    "createdAt",
  ]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="links-${stamp}.csv"`,
    },
  });
}

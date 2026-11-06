import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/api-auth";
import { linkInclude, serializeLink } from "@/lib/links";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 25;

/** Every link on the instance, newest first, with its owner. */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();
  const filter = searchParams.get("filter");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const conditions: Prisma.LinkWhereInput[] = [];
  if (search) {
    conditions.push({
      OR: [
        { shortCode: { contains: search, mode: "insensitive" } },
        { originalUrl: { contains: search, mode: "insensitive" } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ],
    });
  }
  if (filter === "banned") conditions.push({ bannedAt: { not: null } });
  if (filter === "anonymous") conditions.push({ userId: null });
  if (filter === "reported") conditions.push({ reports: { some: { resolved: false } } });
  const where: Prisma.LinkWhereInput = conditions.length ? { AND: conditions } : {};

  const [links, total] = await Promise.all([
    prisma.link.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        ...linkInclude,
        user: { select: { id: true, email: true, name: true } },
        _count: { select: { reports: true } },
      },
    }),
    prisma.link.count({ where }),
  ]);

  return NextResponse.json({
    links: links.map(({ user, _count, ...link }) => ({
      ...serializeLink(link, request),
      owner: user,
      reportCount: _count.reports,
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}

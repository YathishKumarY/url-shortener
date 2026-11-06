import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 25;

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const where: Prisma.UserWhereInput = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        bannedAt: true,
        createdAt: true,
        _count: { select: { links: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    users: users.map(({ _count, ...u }) => ({ ...u, linkCount: _count.links })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}

import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/api-auth";
import { isUniqueConstraintError, jsonError, readJson, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { bioSchema, RESERVED_SHORT_CODES } from "@/lib/validators";

/** The caller's link-in-bio page, plus the links they can feature on it. */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const [page, links] = await Promise.all([
    prisma.bioPage.findUnique({ where: { userId: auth.user.id } }),
    prisma.link.findMany({
      where: { userId: auth.user.id, archived: false, bannedAt: null },
      orderBy: [{ bioPinned: "desc" }, { bioPosition: "asc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        shortCode: true,
        domain: true,
        title: true,
        originalUrl: true,
        bioPinned: true,
        bioPosition: true,
        clickCount: true,
      },
    }),
  ]);
  return NextResponse.json({ page, links });
}

/**
 * Create or update the bio page. `links` (optional) is the ordered list of
 * link ids to feature; every other link is un-featured.
 */
export async function PUT(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = bioSchema.safeParse(body.body);
  if (!parsed.success) return validationError(parsed.error);
  if (RESERVED_SHORT_CODES.has(parsed.data.slug)) return jsonError("That handle is reserved", 400);

  const rawLinks = (body.body as { links?: unknown }).links;
  const featured = Array.isArray(rawLinks)
    ? rawLinks.filter((id): id is string => typeof id === "string").slice(0, 50)
    : null;

  const data = {
    ...parsed.data,
    socials: parsed.data.socials ? (parsed.data.socials as Prisma.InputJsonValue) : Prisma.DbNull,
  };

  try {
    const page = await prisma.bioPage.upsert({
      where: { userId },
      create: { ...data, userId },
      update: data,
    });

    if (featured) {
      await prisma.$transaction([
        prisma.link.updateMany({ where: { userId, bioPinned: true }, data: { bioPinned: false } }),
        ...featured.map((id, index) =>
          prisma.link.updateMany({
            where: { id, userId },
            data: { bioPinned: true, bioPosition: index },
          }),
        ),
      ]);
    }
    return NextResponse.json(page);
  } catch (err) {
    if (isUniqueConstraintError(err)) return jsonError("That handle is already taken", 409);
    throw err;
  }
}

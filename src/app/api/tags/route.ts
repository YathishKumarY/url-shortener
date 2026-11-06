import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { isUniqueConstraintError, jsonError, readJson, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { tagSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const tags = await prisma.tag.findMany({
    where: { userId: auth.user.id },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      createdAt: true,
      _count: { select: { links: true } },
    },
  });
  return NextResponse.json(tags.map(({ _count, ...tag }) => ({ ...tag, linkCount: _count.links })));
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = tagSchema.safeParse(body.body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const tag = await prisma.tag.create({
      data: { ...parsed.data, userId: auth.user.id },
      select: { id: true, name: true, color: true, createdAt: true },
    });
    return NextResponse.json({ ...tag, linkCount: 0 }, { status: 201 });
  } catch (err) {
    if (isUniqueConstraintError(err))
      return jsonError("You already have a tag with that name", 409);
    throw err;
  }
}

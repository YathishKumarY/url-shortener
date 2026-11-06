import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { isUniqueConstraintError, jsonError, readJson, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { tagUpdateSchema } from "@/lib/validators";

export async function PATCH(request: Request, ctx: RouteContext<"/api/tags/[id]">) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = tagUpdateSchema.safeParse(body.body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const { count } = await prisma.tag.updateMany({
      where: { id, userId: auth.user.id },
      data: parsed.data,
    });
    if (count === 0) return jsonError("Tag not found", 404);
    const tag = await prisma.tag.findUnique({
      where: { id },
      select: { id: true, name: true, color: true, createdAt: true },
    });
    return NextResponse.json(tag);
  } catch (err) {
    if (isUniqueConstraintError(err))
      return jsonError("You already have a tag with that name", 409);
    throw err;
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/tags/[id]">) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const { count } = await prisma.tag.deleteMany({ where: { id, userId: auth.user.id } });
  if (count === 0) return jsonError("Tag not found", 404);
  return new NextResponse(null, { status: 204 });
}

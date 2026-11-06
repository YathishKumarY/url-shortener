import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import { jsonError, readJson, validationError } from "@/lib/http";
import { invalidateUserLinks } from "@/lib/link-cache";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  role: z.enum(["USER", "ADMIN"]).optional(),
  banned: z.boolean().optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/users/[id]">) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (id === auth.user.id) return jsonError("You cannot change your own role or ban yourself", 400);

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = updateSchema.safeParse(body.body);
  if (!parsed.success) return validationError(parsed.error);

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return jsonError("User not found", 404);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
      ...(parsed.data.banned !== undefined
        ? { bannedAt: parsed.data.banned ? new Date() : null }
        : {}),
    },
    select: { id: true, name: true, email: true, role: true, bannedAt: true },
  });

  // A ban takes the user's links down too; the cached copies must go so they
  // stop resolving immediately rather than after the cache TTL.
  if (parsed.data.banned !== undefined) await invalidateUserLinks(id);
  return NextResponse.json(updated);
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/users/[id]">) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (id === auth.user.id) return jsonError("Delete your own account from Settings instead", 400);

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return jsonError("User not found", 404);

  await invalidateUserLinks(id);
  await prisma.user.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}

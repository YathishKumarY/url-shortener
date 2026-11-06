import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import { jsonError, readJson, validationError } from "@/lib/http";
import { invalidateLinkCache } from "@/lib/link-cache";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  banned: z.boolean(),
  reason: z.string().trim().max(300).optional(),
});

/** Ban or unban a link. Banned links show a "blocked" notice instead of redirecting. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/links/[id]">) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = updateSchema.safeParse(body.body);
  if (!parsed.success) return validationError(parsed.error);

  const link = await prisma.link.findUnique({
    where: { id },
    select: { domain: true, shortCode: true },
  });
  if (!link) return jsonError("Link not found", 404);

  const updated = await prisma.link.update({
    where: { id },
    data: parsed.data.banned
      ? { bannedAt: new Date(), bannedReason: parsed.data.reason || "Violation of terms" }
      : { bannedAt: null, bannedReason: null },
    select: { id: true, bannedAt: true, bannedReason: true },
  });
  if (parsed.data.banned) {
    await prisma.report.updateMany({
      where: { linkId: id, resolved: false },
      data: { resolved: true },
    });
  }
  await invalidateLinkCache(link);
  return NextResponse.json(updated);
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/links/[id]">) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const link = await prisma.link.findUnique({
    where: { id },
    select: { domain: true, shortCode: true },
  });
  if (!link) return jsonError("Link not found", 404);
  await prisma.link.delete({ where: { id } });
  await invalidateLinkCache(link);
  return new NextResponse(null, { status: 204 });
}

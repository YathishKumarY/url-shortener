import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { clearBlocklistCache } from "@/lib/safety";

export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/admin/blocked-domains/[id]">,
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const { count } = await prisma.blockedDomain.deleteMany({ where: { id } });
  if (count === 0) return jsonError("Not found", 404);
  clearBlocklistCache();
  return new NextResponse(null, { status: 204 });
}

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: Request, ctx: RouteContext<"/api/api-keys/[id]">) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (auth.user.via !== "session")
    return jsonError("API keys can only be managed from the dashboard", 403);
  const { id } = await ctx.params;

  const { count } = await prisma.apiKey.deleteMany({ where: { id, userId: auth.user.id } });
  if (count === 0) return jsonError("API key not found", 404);
  return new NextResponse(null, { status: 204 });
}

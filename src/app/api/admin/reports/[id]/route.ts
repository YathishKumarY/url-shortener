import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import { jsonError, readJson, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const schema = z.object({ resolved: z.boolean() });

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/reports/[id]">) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = schema.safeParse(body.body);
  if (!parsed.success) return validationError(parsed.error);

  const { count } = await prisma.report.updateMany({ where: { id }, data: parsed.data });
  if (count === 0) return jsonError("Report not found", 404);
  return NextResponse.json({ id, ...parsed.data });
}

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { jsonError, readJson, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { assertPublicUrl, UnsafeUrlError } from "@/lib/safe-fetch";
import { webhookUpdateSchema } from "@/lib/validators";
import { webhookSelect } from "@/lib/webhooks";

export async function PATCH(request: Request, ctx: RouteContext<"/api/webhooks/[id]">) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = webhookUpdateSchema.safeParse(body.body);
  if (!parsed.success) return validationError(parsed.error);

  if (parsed.data.url) {
    try {
      await assertPublicUrl(parsed.data.url);
    } catch (err) {
      if (err instanceof UnsafeUrlError) return jsonError(err.message, 400);
      throw err;
    }
  }

  const { count } = await prisma.webhook.updateMany({
    where: { id, userId: auth.user.id },
    data: parsed.data,
  });
  if (count === 0) return jsonError("Webhook not found", 404);
  const hook = await prisma.webhook.findUnique({ where: { id }, select: webhookSelect });
  return NextResponse.json(hook);
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/webhooks/[id]">) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const { count } = await prisma.webhook.deleteMany({ where: { id, userId: auth.user.id } });
  if (count === 0) return jsonError("Webhook not found", 404);
  return new NextResponse(null, { status: 204 });
}

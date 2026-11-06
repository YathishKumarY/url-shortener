import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { deliverWebhook } from "@/lib/webhooks";

/** Send a `ping` event so the owner can check their endpoint and signature code. */
export async function POST(request: Request, ctx: RouteContext<"/api/webhooks/[id]/test">) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const hook = await prisma.webhook.findFirst({
    where: { id, userId: auth.user.id },
    select: { id: true, url: true, secret: true },
  });
  if (!hook) return jsonError("Webhook not found", 404);

  const result = await deliverWebhook(hook, "ping", {
    message: "Webhook test from your Linkly dashboard",
  });
  return NextResponse.json({ ok: !result.error, ...result });
}

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { jsonError, readJson, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { assertPublicUrl, UnsafeUrlError } from "@/lib/safe-fetch";
import { webhookSchema } from "@/lib/validators";
import { generateWebhookSecret, webhookSelect } from "@/lib/webhooks";

const MAX_WEBHOOKS = 10;

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const hooks = await prisma.webhook.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
    select: webhookSelect,
  });
  return NextResponse.json(hooks);
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = webhookSchema.safeParse(body.body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    await assertPublicUrl(parsed.data.url);
  } catch (err) {
    if (err instanceof UnsafeUrlError) return jsonError(err.message, 400);
    throw err;
  }

  const count = await prisma.webhook.count({ where: { userId: auth.user.id } });
  if (count >= MAX_WEBHOOKS) return jsonError(`You can have at most ${MAX_WEBHOOKS} webhooks`, 400);

  const hook = await prisma.webhook.create({
    data: { ...parsed.data, secret: generateWebhookSecret(), userId: auth.user.id },
    select: webhookSelect,
  });
  return NextResponse.json(hook, { status: 201 });
}

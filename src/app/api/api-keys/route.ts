import { NextResponse } from "next/server";
import { generateApiKey, requireUser } from "@/lib/api-auth";
import { jsonError, readJson, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { apiKeySchema } from "@/lib/validators";

const MAX_KEYS = 20;
const keySelect = {
  id: true,
  name: true,
  prefix: true,
  lastUsedAt: true,
  expiresAt: true,
  createdAt: true,
} as const;

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  // Managing keys with a key would let a leaked key mint more keys.
  if (auth.user.via !== "session")
    return jsonError("API keys can only be managed from the dashboard", 403);

  const keys = await prisma.apiKey.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
    select: keySelect,
  });
  return NextResponse.json(keys);
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (auth.user.via !== "session")
    return jsonError("API keys can only be managed from the dashboard", 403);

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = apiKeySchema.safeParse(body.body);
  if (!parsed.success) return validationError(parsed.error);

  const count = await prisma.apiKey.count({ where: { userId: auth.user.id } });
  if (count >= MAX_KEYS) return jsonError(`You can have at most ${MAX_KEYS} API keys`, 400);

  const { key, prefix, hashedKey } = generateApiKey();
  const { expiresInDays } = parsed.data;
  const created = await prisma.apiKey.create({
    data: {
      name: parsed.data.name,
      prefix,
      hashedKey,
      userId: auth.user.id,
      expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000) : null,
    },
    select: keySelect,
  });

  // The only time the full key is ever returned.
  return NextResponse.json({ ...created, key }, { status: 201 });
}

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { jsonError, readJson, validationError } from "@/lib/http";
import { invalidateLinkCache } from "@/lib/link-cache";
import { prisma } from "@/lib/prisma";
import { profileSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      password: true,
      accounts: { select: { provider: true } },
      _count: { select: { links: true, tags: true, apiKeys: true, webhooks: true, domains: true } },
    },
  });
  if (!user) return jsonError("Account not found", 404);

  const { password, accounts, _count, ...profile } = user;
  return NextResponse.json({
    ...profile,
    hasPassword: !!password,
    providers: accounts.map((a) => a.provider),
    counts: _count,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (auth.user.via !== "session")
    return jsonError("Profile changes require a dashboard session", 403);

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = profileSchema.safeParse(body.body);
  if (!parsed.success) return validationError(parsed.error);

  const user = await prisma.user.update({
    where: { id: auth.user.id },
    data: parsed.data,
    select: { id: true, name: true, email: true, image: true },
  });
  return NextResponse.json(user);
}

/**
 * Delete the account and everything in it. The caller must repeat their
 * email address so a stray click (or a CSRF'd request) cannot do this.
 */
export async function DELETE(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (auth.user.via !== "session")
    return jsonError("Account deletion requires a dashboard session", 403);

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const confirm = (body.body as { confirmEmail?: unknown }).confirmEmail;
  if (
    typeof confirm !== "string" ||
    confirm.trim().toLowerCase() !== auth.user.email?.toLowerCase()
  ) {
    return jsonError("Type your email address to confirm", 400);
  }

  const links = await prisma.link.findMany({
    where: { userId: auth.user.id },
    select: { domain: true, shortCode: true },
  });
  await prisma.user.delete({ where: { id: auth.user.id } });
  for (let i = 0; i < links.length; i += 500) await invalidateLinkCache(...links.slice(i, i + 500));

  return new NextResponse(null, { status: 204 });
}

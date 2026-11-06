import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { invalidateDomainCache, serializeDomain } from "@/lib/domains";
import { jsonError, readJson, validationError } from "@/lib/http";
import { invalidateLinkCache } from "@/lib/link-cache";
import { prisma } from "@/lib/prisma";
import { domainUpdateSchema } from "@/lib/validators";

export async function PATCH(request: Request, ctx: RouteContext<"/api/domains/[id]">) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = domainUpdateSchema.safeParse(body.body);
  if (!parsed.success) return validationError(parsed.error);

  const domain = await prisma.domain.findFirst({ where: { id, userId: auth.user.id } });
  if (!domain) return jsonError("Domain not found", 404);

  const updated = await prisma.domain.update({ where: { id }, data: parsed.data });
  await invalidateDomainCache(updated.hostname);
  return NextResponse.json(serializeDomain(updated));
}

/** Remove a domain together with the links that live on it. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/domains/[id]">) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const domain = await prisma.domain.findFirst({ where: { id, userId: auth.user.id } });
  if (!domain) return jsonError("Domain not found", 404);

  const links = await prisma.link.findMany({
    where: { domain: domain.hostname, userId: auth.user.id },
    select: { domain: true, shortCode: true },
  });
  await prisma.$transaction([
    prisma.link.deleteMany({ where: { domain: domain.hostname, userId: auth.user.id } }),
    prisma.domain.delete({ where: { id } }),
  ]);
  await invalidateDomainCache(domain.hostname);
  if (links.length) await invalidateLinkCache(...links);
  return new NextResponse(null, { status: 204 });
}

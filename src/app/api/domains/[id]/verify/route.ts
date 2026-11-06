import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { checkDomainVerification, invalidateDomainCache, serializeDomain } from "@/lib/domains";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

/** Look up the TXT record and mark the domain verified when it matches. */
export async function POST(request: Request, ctx: RouteContext<"/api/domains/[id]/verify">) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const domain = await prisma.domain.findFirst({ where: { id, userId: auth.user.id } });
  if (!domain) return jsonError("Domain not found", 404);

  const result = await checkDomainVerification(domain.hostname, domain.verificationToken);
  const updated =
    result.verified && !domain.verified
      ? await prisma.domain.update({
          where: { id },
          data: { verified: true, verifiedAt: new Date() },
        })
      : domain;
  if (result.verified) await invalidateDomainCache(domain.hostname);

  return NextResponse.json({ ...result, domain: serializeDomain(updated) });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { verifyClaimToken } from "@/lib/claim";
import { readJson, validationError } from "@/lib/http";
import { invalidateLinkCache } from "@/lib/link-cache";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  links: z
    .array(z.object({ id: z.string().min(1).max(64), token: z.string().min(1).max(64) }))
    .min(1)
    .max(100),
});

/** Attach anonymously created links to the signed-in account. */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = schema.safeParse(body.body);
  if (!parsed.success) return validationError(parsed.error);

  const ids = parsed.data.links.filter((l) => verifyClaimToken(l.id, l.token)).map((l) => l.id);
  if (ids.length === 0) return NextResponse.json({ claimed: 0, ids: [] });

  // Only links nobody owns yet; a claimed link cannot be claimed again.
  const claimable = await prisma.link.findMany({
    where: { id: { in: ids }, userId: null },
    select: { id: true, domain: true, shortCode: true },
  });
  if (claimable.length) {
    await prisma.link.updateMany({
      where: { id: { in: claimable.map((l) => l.id) }, userId: null },
      data: { userId: auth.user.id },
    });
    await invalidateLinkCache(...claimable);
  }
  return NextResponse.json({ claimed: claimable.length, ids: claimable.map((l) => l.id) });
}

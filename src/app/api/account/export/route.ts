import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { linkInclude, serializeLink } from "@/lib/links";
import { prisma } from "@/lib/prisma";

/** Everything the account owns, as one JSON download (GDPR data portability). */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const [user, links, tags, domains, bioPage, webhooks, apiKeys] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, image: true, role: true, createdAt: true },
    }),
    prisma.link.findMany({
      where: { userId },
      include: linkInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.tag.findMany({
      where: { userId },
      select: { name: true, color: true, createdAt: true },
    }),
    prisma.domain.findMany({
      where: { userId },
      select: {
        hostname: true,
        verified: true,
        rootRedirect: true,
        notFoundRedirect: true,
        createdAt: true,
      },
    }),
    prisma.bioPage.findUnique({ where: { userId } }),
    prisma.webhook.findMany({
      where: { userId },
      select: { url: true, events: true, enabled: true, createdAt: true },
    }),
    prisma.apiKey.findMany({
      where: { userId },
      select: { name: true, prefix: true, createdAt: true, lastUsedAt: true },
    }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    user,
    links: links.map((link) => serializeLink(link, request)),
    tags,
    domains,
    bioPage,
    webhooks,
    apiKeys,
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="linkly-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

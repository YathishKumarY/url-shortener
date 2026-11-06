import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireUser } from "@/lib/api-auth";
import { isAppHost, serializeDomain } from "@/lib/domains";
import { isUniqueConstraintError, jsonError, readJson, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { domainSchema } from "@/lib/validators";

const MAX_DOMAINS = 10;

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const domains = await prisma.domain.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "asc" },
  });
  const counts = await prisma.link.groupBy({
    by: ["domain"],
    where: { userId: auth.user.id, domain: { in: domains.map((d) => d.hostname) } },
    _count: true,
  });
  const countBy = new Map(counts.map((c) => [c.domain, c._count]));
  return NextResponse.json(domains.map((d) => serializeDomain(d, countBy.get(d.hostname) ?? 0)));
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = domainSchema.safeParse(body.body);
  if (!parsed.success) return validationError(parsed.error);
  const { hostname } = parsed.data;

  if (isAppHost(hostname)) return jsonError("That is this app's own domain", 400);

  const count = await prisma.domain.count({ where: { userId: auth.user.id } });
  if (count >= MAX_DOMAINS) return jsonError(`You can add at most ${MAX_DOMAINS} domains`, 400);

  try {
    const domain = await prisma.domain.create({
      data: {
        hostname,
        userId: auth.user.id,
        verificationToken: randomBytes(16).toString("hex"),
      },
    });
    return NextResponse.json(serializeDomain(domain), { status: 201 });
  } catch (err) {
    if (isUniqueConstraintError(err)) return jsonError("This domain is already registered", 409);
    throw err;
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import { isUniqueConstraintError, jsonError, readJson, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { clearBlocklistCache } from "@/lib/safety";

const schema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) =>
      v
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .replace(/^\*\./, ""),
    )
    .pipe(z.string().regex(/^(?:[a-z0-9-]+\.)+[a-z]{2,63}$/, "Enter a domain like example.com")),
  reason: z.string().trim().max(200).optional(),
});

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const domains = await prisma.blockedDomain.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(domains);
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = schema.safeParse(body.body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const blocked = await prisma.blockedDomain.create({
      data: { domain: parsed.data.domain, reason: parsed.data.reason || null },
    });
    clearBlocklistCache();
    return NextResponse.json(blocked, { status: 201 });
  } catch (err) {
    if (isUniqueConstraintError(err)) return jsonError("That domain is already blocked", 409);
    throw err;
  }
}

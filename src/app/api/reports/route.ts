import { NextResponse } from "next/server";
import { jsonError, readJson, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, getClientIp, reportLimiter } from "@/lib/rate-limit";
import { reportSchema } from "@/lib/validators";

/** Public abuse report for a short link. Reviewed by admins in /admin. */
export async function POST(request: Request) {
  const limit = await enforceRateLimit(
    reportLimiter,
    getClientIp(request),
    "Too many reports from your network. Please try again later.",
  );
  if (!limit.ok) return limit.response;

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = reportSchema.safeParse(body.body);
  if (!parsed.success) return validationError(parsed.error);
  const { code, domain, reason, details, email } = parsed.data;

  const link = await prisma.link.findUnique({
    where: { domain_shortCode: { domain: domain.toLowerCase(), shortCode: code } },
    select: { id: true },
  });
  if (!link) return jsonError("Link not found", 404);

  await prisma.report.create({
    data: { linkId: link.id, reason, details: details || null, email: email || null },
  });
  return NextResponse.json(
    { message: "Thanks - our team will review this link." },
    { status: 201 },
  );
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiLimiter, enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { createLinkSchema } from "@/lib/validators";

/** Live availability check for the alias field: `?alias=summer-sale&domain=`. */
export async function GET(request: Request) {
  const limit = await enforceRateLimit(apiLimiter, `alias:${getClientIp(request)}`);
  if (!limit.ok) return limit.response;

  const { searchParams } = new URL(request.url);
  const alias = (searchParams.get("alias") ?? "").trim();
  const domain = (searchParams.get("domain") ?? "").trim().toLowerCase();

  const parsed = createLinkSchema.safeParse({ url: "https://example.com", customAlias: alias });
  if (!alias || !parsed.success) {
    const message = parsed.success ? "Enter an alias" : parsed.error.issues[0]?.message;
    return NextResponse.json({ available: false, reason: message ?? "Invalid alias" });
  }

  const existing = await prisma.link.findUnique({
    where: { domain_shortCode: { domain, shortCode: alias } },
    select: { id: true },
  });
  return NextResponse.json(
    existing ? { available: false, reason: "This alias is already taken" } : { available: true },
  );
}

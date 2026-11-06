import { NextResponse, after } from "next/server";
import bcrypt from "bcryptjs";
import { claimLimitedClick, recordClick } from "@/lib/analytics";
import { resolveRequestDomain } from "@/lib/domains";
import { jsonError, readJson, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, getClientIp, unlockLimiter } from "@/lib/rate-limit";
import {
  evaluateGates,
  forwardQueryParams,
  pickDestination,
  toRedirectLink,
  visitSource,
} from "@/lib/redirect";
import { unlockSchema } from "@/lib/validators";
import { parseVisitor } from "@/lib/visitor";

const GATE_MESSAGES = {
  banned: "This link has been disabled for violating our terms.",
  disabled: "This link has been paused by its owner.",
  scheduled: "This link is not active yet.",
  expired: "This link has expired.",
} as const;

/**
 * Check a protected link's password and return where to go. The namespace
 * comes from the Host header, since the unlock page is served on the same
 * domain as the short link.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = unlockSchema.safeParse(body.body);
  if (!parsed.success) return validationError(parsed.error);
  const { code, password } = parsed.data;
  const query = new URLSearchParams(
    typeof (body.body as { query?: unknown }).query === "string"
      ? (body.body as { query: string }).query
      : "",
  );

  const { domain } = await resolveRequestDomain(request);
  const limit = await enforceRateLimit(
    unlockLimiter,
    `${getClientIp(request)}:${domain}:${code}`,
    "Too many attempts. Please wait a few minutes and try again.",
  );
  if (!limit.ok) return limit.response;

  const row = await prisma.link.findUnique({
    where: { domain_shortCode: { domain, shortCode: code } },
    include: { user: { select: { bannedAt: true } } },
  });
  if (!row) return jsonError("Link not found", 404);

  const link = toRedirectLink(row);
  const gate = evaluateGates(link);
  if (gate.kind === "expired" && gate.fallback) return NextResponse.json({ url: gate.fallback });
  if (gate.kind !== "ok") return jsonError(GATE_MESSAGES[gate.kind], 410);

  if (row.password && !(await bcrypt.compare(password, row.password))) {
    return jsonError("Incorrect password", 401);
  }

  const visitor = parseVisitor(request);
  let counted = false;
  if (link.maxClicks !== null && !visitor.isBot) {
    if (!(await claimLimitedClick(link.id, link.maxClicks))) {
      return link.expiredUrl
        ? NextResponse.json({ url: link.expiredUrl })
        : jsonError("This link has reached its click limit.", 410);
    }
    counted = true;
  }

  const destination = pickDestination(link, {
    platform: visitor.platform,
    country: visitor.country,
  });
  const target = link.forwardQuery ? forwardQueryParams(destination.url, query) : destination.url;

  after(async () => {
    try {
      await recordClick({
        link,
        visitor,
        source: visitSource(query),
        destination: target,
        counted,
      });
    } catch (err) {
      console.error("[unlock] Click recording failed:", err);
    }
  });

  return NextResponse.json({ url: target, cloaked: link.cloaked, title: link.title });
}

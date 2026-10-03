import { NextResponse } from "next/server";
import { buildShortUrl } from "@/lib/app-url";
import { auth } from "@/lib/auth";
import { cacheSet } from "@/lib/cache";
import { generateShortCode } from "@/lib/nanoid";
import { prisma } from "@/lib/prisma";
import { createLinkLimiter, getClientIp } from "@/lib/rate-limit";
import { createLinkSchema, linkQuerySchema, formatZodErrors } from "@/lib/validators";

const CACHE_TTL_SECONDS = 86400;

/**
 * Detect a unique-constraint violation by Prisma's error code rather than by
 * matching on the message text, which is not part of Prisma's stable API and
 * changes with locale and version.
 */
function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  try {
    const { success, limit, remaining, reset } = await createLinkLimiter.limit(ip);
    const headers = {
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(reset),
    };
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers },
      );
    }
  } catch (err) {
    console.error("[links] Rate limit check failed:", err);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body. Please send valid JSON." },
      { status: 400 },
    );
  }

  const parsed = createLinkSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: formatZodErrors(parsed.error) }, { status: 400 });
  }

  const { url, customAlias, expiresAt } = parsed.data;

  const session = await auth();
  const userId = session?.user?.id ?? null;

  try {
    let shortCode: string = customAlias ? customAlias : generateShortCode();

    let link;
    let attempts = 0;
    const maxAttempts = customAlias ? 1 : 5;

    while (attempts < maxAttempts) {
      try {
        link = await prisma.link.create({
          data: {
            shortCode,
            originalUrl: url,
            customAlias: customAlias ?? null,
            userId,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
          },
        });
        break;
      } catch (err: unknown) {
        if (!isUniqueConstraintError(err)) throw err;
        if (customAlias) {
          return NextResponse.json({ error: "This alias is already taken" }, { status: 409 });
        }
        shortCode = generateShortCode();
        attempts++;
      }
    }

    if (!link) {
      return NextResponse.json(
        { error: "Unable to generate a unique short code. Please try again." },
        { status: 503 },
      );
    }

    const expiresAtMs = link.expiresAt ? new Date(link.expiresAt).getTime() : null;
    const ttl = expiresAtMs
      ? Math.min(CACHE_TTL_SECONDS, Math.ceil((expiresAtMs - Date.now()) / 1000))
      : CACHE_TTL_SECONDS;
    if (ttl > 0) {
      // Same shape the redirect handler expects, so it can honour expiry
      // without a database round trip.
      await cacheSet(
        `link:${link.shortCode}`,
        JSON.stringify({ id: link.id, originalUrl: url, expiresAt: expiresAtMs }),
        ttl,
      );
    }

    return NextResponse.json(
      {
        id: link.id,
        shortCode: link.shortCode,
        shortUrl: buildShortUrl(link.shortCode, request),
        originalUrl: link.originalUrl,
        createdAt: link.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[links] Failed to create link:", error);
    return NextResponse.json(
      { error: "Failed to create link. Please try again." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = linkQuerySchema.safeParse({
    page: searchParams.get("page") ?? "1",
    // Accept `pageSize` as an alias for `limit` so either naming works.
    limit: searchParams.get("limit") ?? searchParams.get("pageSize") ?? "20",
    search: searchParams.get("search") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: formatZodErrors(parsed.error) }, { status: 400 });
  }

  const { page, limit, search } = parsed.data;
  const skip = (page - 1) * limit;

  try {
    const where = {
      userId: session.user.id,
      ...(search
        ? {
            OR: [
              { shortCode: { contains: search, mode: "insensitive" as const } },
              { originalUrl: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [links, total] = await Promise.all([
      prisma.link.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.link.count({ where }),
    ]);

    // `pageSize` mirrors `limit` so clients using either name agree with the
    // value actually applied to the query.
    return NextResponse.json({ links, total, page, limit, pageSize: limit });
  } catch (error) {
    console.error("[links] Failed to fetch links:", error);
    return NextResponse.json(
      { error: "Failed to fetch links. Please try again." },
      { status: 500 },
    );
  }
}

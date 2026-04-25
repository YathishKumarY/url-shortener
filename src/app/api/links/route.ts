import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateShortCode } from "@/lib/nanoid";
import { prisma } from "@/lib/prisma";
import { createLinkLimiter, getClientIp } from "@/lib/rate-limit";
import { redis } from "@/lib/redis";
import { createLinkSchema, linkQuerySchema, formatZodErrors } from "@/lib/validators";

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

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  const protocol = new URL(url).protocol;
  if (!["http:", "https:"].includes(protocol)) {
    return NextResponse.json({ error: "Only http and https URLs are allowed" }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;

  try {
    let shortCode: string;

    if (customAlias) {
      shortCode = customAlias;
    } else {
      shortCode = generateShortCode();
    }

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
        const isUniqueViolation = err instanceof Error && err.message.includes("Unique constraint");
        if (isUniqueViolation && customAlias) {
          return NextResponse.json({ error: "This alias is already taken" }, { status: 409 });
        }
        if (isUniqueViolation && !customAlias) {
          shortCode = generateShortCode();
          attempts++;
          continue;
        }
        throw err;
      }
    }

    if (!link) {
      return NextResponse.json(
        { error: "Unable to generate a unique short code. Please try again." },
        { status: 503 },
      );
    }

    try {
      await redis.set(`link:${shortCode}`, url, { ex: 86400 });
    } catch (err) {
      console.error("[links] Redis cache set failed:", err);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    return NextResponse.json(
      {
        id: link.id,
        shortCode: link.shortCode,
        shortUrl: `${appUrl}/${link.shortCode}`,
        originalUrl: link.originalUrl,
        createdAt: link.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[links] Failed to create link:", error);
    return NextResponse.json({ status: 500 });
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
    limit: searchParams.get("limit") ?? "20",
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

    return NextResponse.json({ links, total, page, limit });
  } catch (error) {
    console.error("[links] Failed to fetch links:", error);
    return NextResponse.json(
      { error: "Failed to fetch links. Please try again." },
      { status: 500 },
    );
  }
}

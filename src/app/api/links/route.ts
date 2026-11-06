import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { getRequestUser, requireUser } from "@/lib/api-auth";
import { createClaimToken } from "@/lib/claim";
import { config } from "@/lib/config";
import { jsonError, readJson, validationError } from "@/lib/http";
import {
  createLink,
  linkErrorResponse,
  linkInclude,
  serializeLink,
  statusWhere,
} from "@/lib/links";
import { prisma } from "@/lib/prisma";
import {
  createLinkLimiter,
  enforceRateLimit,
  getClientIp,
  userWriteLimiter,
} from "@/lib/rate-limit";
import { createLinkSchema, linkQuerySchema } from "@/lib/validators";

export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user && config.anonymousLinksDisabled) {
    return jsonError("Sign in to create links on this instance", 401);
  }

  const limit = user
    ? await enforceRateLimit(userWriteLimiter, `user:${user.id}`)
    : await enforceRateLimit(createLinkLimiter, getClientIp(request));
  if (!limit.ok) return limit.response;

  const body = await readJson(request);
  if (!body.ok) return body.response;

  const parsed = createLinkSchema.safeParse(body.body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const link = await createLink({ input: parsed.data, userId: user?.id ?? null, request });
    const payload = serializeLink(link, request);
    // Anonymous creators get a token to claim the link after signing up.
    const claimToken = user ? null : createClaimToken(link.id);
    return NextResponse.json(claimToken ? { ...payload, claimToken } : payload, {
      status: 201,
      headers: limit.headers,
    });
  } catch (err) {
    return linkErrorResponse(err);
  }
}

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const parsed = linkQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    // Accept `pageSize` as an alias for `limit` so either naming works.
    limit: searchParams.get("limit") ?? searchParams.get("pageSize") ?? undefined,
    search: searchParams.get("search") || undefined,
    status: searchParams.get("status") || undefined,
    tag: searchParams.get("tag") || undefined,
    domain: searchParams.get("domain") ?? undefined,
    sort: searchParams.get("sort") || undefined,
    order: searchParams.get("order") || undefined,
  });
  if (!parsed.success) return validationError(parsed.error);

  const { page, limit, search, status, tag, domain, sort, order } = parsed.data;

  const filters: Prisma.LinkWhereInput[] = [{ userId: auth.user.id }, statusWhere(status)];
  if (search) {
    filters.push({
      OR: [
        { shortCode: { contains: search, mode: "insensitive" } },
        { originalUrl: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  if (tag) filters.push({ tags: { some: { id: tag } } });
  if (domain !== undefined) filters.push({ domain: domain === "default" ? "" : domain });
  const where: Prisma.LinkWhereInput = { AND: filters };

  const orderBy: Prisma.LinkOrderByWithRelationInput[] =
    sort === "clicks"
      ? [{ clickCount: order }]
      : sort === "lastClickedAt"
        ? [{ lastClickedAt: { sort: order, nulls: "last" } }]
        : sort === "title"
          ? [{ title: { sort: order, nulls: "last" } }]
          : [{ createdAt: order }];
  orderBy.push({ id: "desc" });

  try {
    const [links, total] = await Promise.all([
      prisma.link.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: linkInclude,
      }),
      prisma.link.count({ where }),
    ]);

    return NextResponse.json({
      links: links.map((link) => serializeLink(link, request)),
      total,
      page,
      limit,
      // `pageSize` mirrors `limit` for clients using either name.
      pageSize: limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error("[links] Failed to fetch links:", error);
    return jsonError("Failed to fetch links. Please try again.", 500);
  }
}

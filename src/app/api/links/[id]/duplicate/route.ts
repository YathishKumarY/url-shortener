import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/api-auth";
import { isUniqueConstraintError, jsonError } from "@/lib/http";
import { cacheRedirectLink } from "@/lib/link-cache";
import { findOwnedLink, linkErrorResponse, linkInclude, serializeLink } from "@/lib/links";
import { generateShortCode } from "@/lib/nanoid";
import { prisma } from "@/lib/prisma";
import { toRedirectLink } from "@/lib/redirect";

/** Copy a link's settings to a new random short code. Stats are not copied. */
export async function POST(request: Request, ctx: RouteContext<"/api/links/[id]/duplicate">) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  try {
    const source = await findOwnedLink(id, auth.user.id);
    if (!source) return jsonError("Link not found", 404);

    // Settings carried over to the copy; identity, counters and moderation state are not.
    const settings = {
      domain: source.domain,
      originalUrl: source.originalUrl,
      userId: source.userId,
      description: source.description,
      password: source.password,
      expiresAt: source.expiresAt,
      expiredUrl: source.expiredUrl,
      startsAt: source.startsAt,
      maxClicks: source.maxClicks,
      disabled: source.disabled,
      archived: source.archived,
      redirectType: source.redirectType,
      forwardQuery: source.forwardQuery,
      hideReferrer: source.hideReferrer,
      cloaked: source.cloaked,
      noLog: source.noLog,
      iosUrl: source.iosUrl,
      androidUrl: source.androidUrl,
      ogTitle: source.ogTitle,
      ogDescription: source.ogDescription,
      ogImage: source.ogImage,
      publicStats: source.publicStats,
      bioPinned: false,
    };
    const { tags, geoTargets, abVariants } = source;

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const copy = await prisma.link.create({
          data: {
            ...settings,
            shortCode: generateShortCode(),
            title: source.title ? `${source.title} (copy)` : null,
            geoTargets: geoTargets ?? Prisma.DbNull,
            abVariants: abVariants ?? Prisma.DbNull,
            tags: { connect: tags.map((t) => ({ id: t.id })) },
          },
          include: linkInclude,
        });
        await cacheRedirectLink(toRedirectLink(copy));
        return NextResponse.json(serializeLink(copy, request), { status: 201 });
      } catch (err) {
        if (!isUniqueConstraintError(err)) throw err;
      }
    }
    return jsonError("Unable to generate a unique short code. Please try again.", 503);
  } catch (err) {
    return linkErrorResponse(err);
  }
}

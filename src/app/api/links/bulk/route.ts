import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { config } from "@/lib/config";
import { jsonError, readJson, validationError } from "@/lib/http";
import { invalidateLinkCache } from "@/lib/link-cache";
import {
  createLink,
  deleteLinks,
  LinkError,
  resolveTags,
  serializeLink,
  type BulkResult,
} from "@/lib/links";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, userWriteLimiter } from "@/lib/rate-limit";
import {
  bulkActionSchema,
  bulkCreateSchema,
  createLinkSchema,
  firstZodError,
} from "@/lib/validators";

/** Create up to BULK_LINK_LIMIT links in one request (TinyURL-style bulk shortening). */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const limit = await enforceRateLimit(userWriteLimiter, `user:${auth.user.id}`);
  if (!limit.ok) return limit.response;

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = bulkCreateSchema.safeParse(body.body);
  if (!parsed.success) return validationError(parsed.error);

  const { links, tags: sharedTags = [] } = parsed.data;
  if (links.length > config.bulkLimit) {
    return jsonError(`At most ${config.bulkLimit} links per request`, 400);
  }

  const results: BulkResult[] = [];
  // Sequential on purpose: keeps result order stable and stays well inside
  // the database pool when someone pastes a hundred URLs.
  for (const [index, item] of links.entries()) {
    const input = createLinkSchema.safeParse({
      url: item.url,
      customAlias: item.customAlias || undefined,
      title: item.title || undefined,
      tags: [...sharedTags, ...(item.tags ?? [])],
    });
    if (!input.success) {
      results.push({ index, ok: false, error: firstZodError(input.error) });
      continue;
    }
    try {
      const link = await createLink({ input: input.data, userId: auth.user.id, request });
      results.push({ index, ok: true, link: serializeLink(link, request) });
    } catch (err) {
      results.push({
        index,
        ok: false,
        error: err instanceof LinkError ? err.message : "Failed to create link",
      });
      if (!(err instanceof LinkError)) console.error("[bulk] create failed:", err);
    }
  }

  const created = results.filter((r) => r.ok).length;
  return NextResponse.json(
    { created, failed: results.length - created, results },
    { status: created > 0 ? 201 : 400 },
  );
}

/** Apply one action to many links: delete, archive, disable, tag... */
export async function PATCH(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = bulkActionSchema.safeParse(body.body);
  if (!parsed.success) return validationError(parsed.error);
  const { ids, action, tag } = parsed.data;

  try {
    const links = await prisma.link.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true, domain: true, shortCode: true },
    });
    const ownedIds = links.map((l) => l.id);
    if (ownedIds.length === 0) return jsonError("No matching links", 404);

    let affected = ownedIds.length;
    switch (action) {
      case "delete":
        affected = await deleteLinks(userId, links);
        break;
      case "archive":
      case "unarchive":
        await prisma.link.updateMany({
          where: { id: { in: ownedIds } },
          data: { archived: action === "archive" },
        });
        break;
      case "disable":
      case "enable":
        await prisma.link.updateMany({
          where: { id: { in: ownedIds } },
          data: { disabled: action === "disable" },
        });
        await invalidateLinkCache(...links);
        break;
      case "addTag": {
        const [tagRef] = await resolveTags(userId, [tag!]);
        await prisma.$transaction(
          ownedIds.map((id) =>
            prisma.link.update({ where: { id }, data: { tags: { connect: tagRef } } }),
          ),
        );
        break;
      }
      case "removeTag": {
        const existing = await prisma.tag.findFirst({
          where: { userId, name: { equals: tag!, mode: "insensitive" } },
          select: { id: true },
        });
        if (existing) {
          await prisma.$transaction(
            ownedIds.map((id) =>
              prisma.link.update({ where: { id }, data: { tags: { disconnect: existing } } }),
            ),
          );
        }
        break;
      }
    }

    return NextResponse.json({ action, affected });
  } catch (err) {
    console.error("[bulk] action failed:", err);
    return jsonError("Bulk action failed. Please try again.", 500);
  }
}

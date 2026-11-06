import { NextResponse, after } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma, type Link } from "@/generated/prisma/client";
import { buildShortUrl, displayShortUrl } from "@/lib/app-url";
import { isUniqueConstraintError } from "@/lib/http";
import { cacheRedirectLink, invalidateLinkCache } from "@/lib/link-cache";
import { fetchPageMetadata } from "@/lib/metadata";
import { generateEmojiCode, generateShortCode } from "@/lib/nanoid";
import { prisma } from "@/lib/prisma";
import { parseGeoTargets, parseVariants, toRedirectLink } from "@/lib/redirect";
import { checkLinkDestinations } from "@/lib/safety";
import {
  isReservedShortCode,
  TAG_COLORS,
  type CreateLinkInput,
  type UpdateLinkInput,
} from "@/lib/validators";
import { dispatchWebhooks } from "@/lib/webhooks";

export const tagSelect = { select: { id: true, name: true, color: true } } as const;
export const linkInclude = { tags: tagSelect } as const;

export type LinkWithTags = Link & { tags: Array<{ id: string; name: string; color: string }> };

export type LinkStatus = "active" | "expired" | "limited" | "scheduled" | "disabled" | "banned";

export class LinkError extends Error {
  constructor(
    message: string,
    public status = 400,
    public field?: string,
  ) {
    super(message);
  }
}

/** Map a thrown error to a response: LinkErrors carry their own status. */
export function linkErrorResponse(err: unknown, context = "[links]") {
  if (err instanceof LinkError) {
    return NextResponse.json(
      { error: err.message, ...(err.field ? { fieldErrors: { [err.field]: [err.message] } } : {}) },
      { status: err.status },
    );
  }
  console.error(`${context} request failed:`, err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

/** A link owned by the user, with tags, or null. */
export function findOwnedLink(id: string, userId: string) {
  return prisma.link.findFirst({ where: { id, userId }, include: linkInclude });
}

export function linkStatus(
  link: Pick<Link, "bannedAt" | "disabled" | "startsAt" | "expiresAt" | "maxClicks" | "clickCount">,
  now = Date.now(),
): LinkStatus {
  if (link.bannedAt) return "banned";
  if (link.disabled) return "disabled";
  if (link.startsAt && link.startsAt.getTime() > now) return "scheduled";
  if (link.expiresAt && link.expiresAt.getTime() <= now) return "expired";
  if (link.maxClicks !== null && link.clickCount >= link.maxClicks) return "limited";
  return "active";
}

/** The API shape of a link. Never includes the password hash. */
export function serializeLink(link: LinkWithTags, request?: Request) {
  const options = { domain: link.domain || null, request };
  return {
    id: link.id,
    domain: link.domain || null,
    shortCode: link.shortCode,
    shortUrl: buildShortUrl(link.shortCode, options),
    displayUrl: displayShortUrl(link.shortCode, options),
    originalUrl: link.originalUrl,
    customAlias: link.customAlias,
    title: link.title,
    description: link.description,
    hasPassword: !!link.password,
    expiresAt: link.expiresAt,
    expiredUrl: link.expiredUrl,
    startsAt: link.startsAt,
    maxClicks: link.maxClicks,
    disabled: link.disabled,
    archived: link.archived,
    redirectType: link.redirectType,
    forwardQuery: link.forwardQuery,
    hideReferrer: link.hideReferrer,
    cloaked: link.cloaked,
    noLog: link.noLog,
    iosUrl: link.iosUrl,
    androidUrl: link.androidUrl,
    geoTargets: parseGeoTargets(link.geoTargets),
    abVariants: parseVariants(link.abVariants),
    ogTitle: link.ogTitle,
    ogDescription: link.ogDescription,
    ogImage: link.ogImage,
    publicStats: link.publicStats,
    bioPinned: link.bioPinned,
    bioPosition: link.bioPosition,
    banned: !!link.bannedAt,
    bannedReason: link.bannedReason,
    status: linkStatus(link),
    clickCount: link.clickCount,
    lastClickedAt: link.lastClickedAt,
    tags: link.tags,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  };
}

export type PublicLink = ReturnType<typeof serializeLink>;

/** Per-row outcome of a bulk create or CSV import. */
export interface BulkResult {
  index: number;
  ok: boolean;
  link?: PublicLink;
  error?: string;
}

/** Deterministic colour for a tag created implicitly by name. */
function colorFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length];
}

/** Find or create the user's tags by name (case-insensitive match on existing). */
export async function resolveTags(userId: string, names: string[]): Promise<Array<{ id: string }>> {
  const unique = [...new Map(names.map((n) => [n.trim().toLowerCase(), n.trim()])).values()].filter(
    Boolean,
  );
  if (unique.length === 0) return [];

  const existing = await prisma.tag.findMany({
    where: { userId, name: { in: unique, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  const byName = new Map(existing.map((t) => [t.name.toLowerCase(), t.id]));

  const ids: Array<{ id: string }> = [];
  for (const name of unique) {
    const found = byName.get(name.toLowerCase());
    if (found) {
      ids.push({ id: found });
      continue;
    }
    const tag = await prisma.tag.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name, color: colorFor(name) },
      update: {},
      select: { id: true },
    });
    ids.push(tag);
  }
  return ids;
}

async function assertDomainUsable(userId: string | null, domain: string): Promise<void> {
  if (!domain) return;
  if (!userId) throw new LinkError("Sign in to use a custom domain", 403, "domain");
  const record = await prisma.domain.findUnique({ where: { hostname: domain } });
  if (!record || record.userId !== userId) {
    throw new LinkError("Unknown domain. Add it under Settings > Domains first.", 400, "domain");
  }
  if (!record.verified) {
    throw new LinkError("Verify this domain before creating links on it", 400, "domain");
  }
}

function jsonOrDbNull(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

function allDestinations(input: Partial<CreateLinkInput> & { originalUrl?: string }) {
  return [
    input.url,
    input.originalUrl,
    input.expiredUrl,
    input.iosUrl,
    input.androidUrl,
    ...Object.values(input.geoTargets ?? {}),
    ...(input.abVariants ?? []).map((v) => v.url),
  ];
}

/** Optional fields shared by create and update, mapped to columns. */
function optionColumns(input: Partial<CreateLinkInput>) {
  return {
    title: input.title,
    description: input.description,
    expiredUrl: input.expiredUrl,
    startsAt:
      input.startsAt === undefined ? undefined : input.startsAt ? new Date(input.startsAt) : null,
    maxClicks: input.maxClicks,
    disabled: input.disabled,
    archived: input.archived,
    redirectType: input.redirectType,
    forwardQuery: input.forwardQuery,
    hideReferrer: input.hideReferrer,
    cloaked: input.cloaked,
    noLog: input.noLog,
    iosUrl: input.iosUrl,
    androidUrl: input.androidUrl,
    geoTargets: jsonOrDbNull(input.geoTargets),
    abVariants: jsonOrDbNull(input.abVariants),
    ogTitle: input.ogTitle,
    ogDescription: input.ogDescription,
    ogImage: input.ogImage,
    publicStats: input.publicStats,
    bioPinned: input.bioPinned,
  };
}

async function hashLinkPassword(
  password: string | null | undefined,
): Promise<string | null | undefined> {
  if (password === undefined) return undefined;
  if (!password) return null;
  return bcrypt.hash(password, 10);
}

/** Fill in the destination's page title in the background. */
function scheduleTitleFetch(linkId: string, url: string) {
  after(async () => {
    const meta = await fetchPageMetadata(url);
    if (!meta.title) return;
    await prisma.link
      .updateMany({ where: { id: linkId, title: null }, data: { title: meta.title } })
      .catch(() => {});
  });
}

interface CreateOptions {
  input: CreateLinkInput;
  userId: string | null;
  request?: Request;
}

/**
 * Create a link. Anonymous callers get the core options only - a custom
 * alias, emoji code, password, expiry and click limit (enough for a
 * self-destructing or password-protected share) - since they have no
 * dashboard to manage anything more.
 */
export async function createLink({ input, userId, request }: CreateOptions): Promise<LinkWithTags> {
  const safety = await checkLinkDestinations(allDestinations(input));
  if (!safety.ok) throw new LinkError(safety.reason, 400, "url");

  const domain = userId ? (input.domain ?? "") : "";
  await assertDomainUsable(userId, domain);

  const options = userId ? optionColumns(input) : {};
  const password = await hashLinkPassword(input.password);
  const tags = userId && input.tags?.length ? await resolveTags(userId, input.tags) : [];
  const alias = input.customAlias?.trim() || null;

  let shortCode = alias ?? (input.emoji ? generateEmojiCode() : generateShortCode());
  const maxAttempts = alias ? 1 : 5;
  let link: LinkWithTags | null = null;

  for (let attempt = 0; attempt < maxAttempts && !link; attempt++) {
    try {
      link = await prisma.link.create({
        data: {
          ...options,
          domain,
          shortCode,
          originalUrl: input.url,
          customAlias: alias,
          userId,
          password,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          maxClicks: input.maxClicks ?? null,
          ...(tags.length ? { tags: { connect: tags } } : {}),
        },
        include: linkInclude,
      });
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
      if (alias) throw new LinkError("This alias is already taken", 409, "customAlias");
      shortCode = input.emoji ? generateEmojiCode() : generateShortCode();
    }
  }

  if (!link) throw new LinkError("Unable to generate a unique short code. Please try again.", 503);

  // Prime the cache in the exact shape the redirect handler reads.
  await cacheRedirectLink(toRedirectLink(link));
  if (!link.title) scheduleTitleFetch(link.id, link.originalUrl);

  const created = link;
  after(() => dispatchWebhooks(userId, "link.created", { link: serializeLink(created, request) }));
  return link;
}

interface UpdateOptions {
  link: LinkWithTags;
  input: UpdateLinkInput;
  userId: string;
  request?: Request;
}

export async function updateLink({
  link,
  input,
  userId,
  request,
}: UpdateOptions): Promise<LinkWithTags> {
  const destination = input.url ?? input.originalUrl;
  const safety = await checkLinkDestinations(allDestinations({ ...input, url: destination }));
  if (!safety.ok) throw new LinkError(safety.reason, 400, "url");

  const data: Prisma.LinkUncheckedUpdateInput = { ...optionColumns(input) };
  if (destination) data.originalUrl = destination;
  if (input.expiresAt !== undefined)
    data.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  const password = await hashLinkPassword(input.password);
  if (password !== undefined) data.password = password;

  const domain = input.domain ?? link.domain;
  if (domain !== link.domain) {
    await assertDomainUsable(userId, domain);
    data.domain = domain;
  }

  const alias = input.customAlias?.trim();
  if (alias && alias !== link.shortCode) {
    if (isReservedShortCode(alias))
      throw new LinkError("This alias is reserved", 400, "customAlias");
    data.shortCode = alias;
    data.customAlias = alias;
  }

  if (input.tags !== undefined) {
    const tags = await resolveTags(userId, input.tags);
    data.tags = { set: tags };
  }

  // Strip undefined so Prisma leaves those columns alone.
  for (const key of Object.keys(data) as Array<keyof typeof data>) {
    if (data[key] === undefined) delete data[key];
  }
  if (Object.keys(data).length === 0) return link;

  let updated: LinkWithTags;
  try {
    updated = await prisma.link.update({ where: { id: link.id }, data, include: linkInclude });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new LinkError("This alias is already taken", 409, "customAlias");
    }
    throw err;
  }

  // Every edit can change the redirect decision (destination, expiry, rules),
  // so drop both the old and the new cache keys.
  await invalidateLinkCache(link, updated);
  if (destination && destination !== link.originalUrl && !input.title && !link.title) {
    scheduleTitleFetch(updated.id, updated.originalUrl);
  }

  after(() => dispatchWebhooks(userId, "link.updated", { link: serializeLink(updated, request) }));
  return updated;
}

export async function deleteLinks(
  userId: string,
  links: Array<Pick<Link, "id" | "domain" | "shortCode">>,
): Promise<number> {
  if (links.length === 0) return 0;
  const { count } = await prisma.link.deleteMany({
    where: { id: { in: links.map((l) => l.id) }, userId },
  });
  await invalidateLinkCache(...links);
  after(() =>
    Promise.all(
      links.map((l) =>
        dispatchWebhooks(userId, "link.deleted", {
          link: { id: l.id, shortCode: l.shortCode, domain: l.domain || null },
        }),
      ),
    ),
  );
  return count;
}

/** Prisma filter for a dashboard status tab. */
export function statusWhere(status: string, now = new Date()): Prisma.LinkWhereInput {
  switch (status) {
    case "active":
      return {
        archived: false,
        disabled: false,
        bannedAt: null,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          { OR: [{ maxClicks: null }, { clickCount: { lt: prisma.link.fields.maxClicks } }] },
        ],
      };
    case "expired":
      return {
        OR: [
          { expiresAt: { lte: now } },
          {
            AND: [
              { maxClicks: { not: null } },
              { clickCount: { gte: prisma.link.fields.maxClicks } },
            ],
          },
        ],
      };
    case "scheduled":
      return { startsAt: { gt: now } };
    case "disabled":
      return { disabled: true };
    case "archived":
      return { archived: true };
    case "protected":
      return { password: { not: null } };
    default:
      return { archived: false };
  }
}

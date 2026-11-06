import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { isBot } from "ua-parser-js/bot-detection";
import { BioProfile, type BioProfileLink } from "@/components/bio/bio-profile";
import { parseSocials } from "@/components/bio/socials";
import { getBioTheme } from "@/components/bio/themes";
import { bioLinkTitle, HANDLE_PATTERN } from "@/components/bio/utils";
import { buildShortUrl, getAppOrigin } from "@/lib/app-url";
import { linkStatus } from "@/lib/links";
import { prisma } from "@/lib/prisma";
import type { Metadata, Viewport } from "next";

interface BioRouteProps {
  params: Promise<{ slug: string }>;
}

/**
 * A published page whose owner is in good standing, or null.
 * Wrapped in `cache` so metadata, viewport and the page share one query.
 */
const loadBioPage = cache(async (rawSlug: string) => {
  const slug = rawSlug.toLowerCase();
  // Anything that cannot be a handle is a miss without touching the database.
  if (!HANDLE_PATTERN.test(slug)) return null;

  const page = await prisma.bioPage.findUnique({
    where: { slug },
    include: { user: { select: { name: true, image: true, bannedAt: true } } },
  });
  if (!page || !page.published || page.user.bannedAt) return null;
  return page;
});

export async function generateMetadata({ params }: BioRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadBioPage(slug);
  if (!page) return { title: "Page not found", robots: { index: false, follow: false } };

  const name = page.displayName?.trim() || page.slug;
  const title = `${name} (@${page.slug})`;
  const description = page.bio?.trim() || `All of ${name}'s links in one place, on Linkly.`;
  const path = `/@${page.slug}`;

  return {
    metadataBase: new URL(getAppOrigin()),
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "profile",
      title,
      description,
      url: path,
      username: page.slug,
      images: page.avatarUrl ? [{ url: page.avatarUrl, alt: name }] : undefined,
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: page.avatarUrl ? [page.avatarUrl] : undefined,
    },
  };
}

export async function generateViewport({ params }: BioRouteProps): Promise<Viewport> {
  const { slug } = await params;
  const theme = getBioTheme((await loadBioPage(slug))?.theme);
  return { themeColor: theme.themeColor, colorScheme: theme.scheme };
}

export default async function PublicBioPage({ params }: BioRouteProps) {
  const { slug } = await params;
  const page = await loadBioPage(slug);
  if (!page) notFound();

  const rows = await prisma.link.findMany({
    where: {
      userId: page.userId,
      bioPinned: true,
      archived: false,
      disabled: false,
      bannedAt: null,
    },
    orderBy: { bioPosition: "asc" },
    take: 50,
    select: {
      id: true,
      shortCode: true,
      domain: true,
      title: true,
      originalUrl: true,
      bannedAt: true,
      disabled: true,
      startsAt: true,
      expiresAt: true,
      maxClicks: true,
      clickCount: true,
    },
  });

  // Expired, scheduled and capped links would only lead to a notice page.
  const links: BioProfileLink[] = rows
    .filter((link) => linkStatus(link) === "active")
    .map((link) => ({
      id: link.id,
      title: bioLinkTitle(link),
      url: link.originalUrl,
      // `src=bio` attributes the click to this page in the link's analytics.
      href: `${buildShortUrl(link.shortCode, { domain: link.domain || null })}?src=bio`,
    }));

  // Count human visits once the response is on its way. Reading headers also
  // keeps this route dynamic, so every visit renders fresh.
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent") ?? "";
  const purpose = `${requestHeaders.get("sec-purpose") ?? ""} ${requestHeaders.get("purpose") ?? ""}`;
  const speculative =
    /prefetch|prerender/i.test(purpose) || requestHeaders.has("next-router-prefetch");
  if (userAgent && !isBot(userAgent) && !speculative) {
    after(() =>
      prisma.bioPage
        .update({ where: { id: page.id }, data: { views: { increment: 1 } } })
        .catch(() => {}),
    );
  }

  return (
    <BioProfile
      variant="page"
      slug={page.slug}
      displayName={page.displayName}
      bio={page.bio}
      avatarUrl={page.avatarUrl ?? page.user.image}
      theme={page.theme}
      socials={parseSocials(page.socials)}
      links={links}
    />
  );
}

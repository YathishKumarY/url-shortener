import { NextResponse, after } from "next/server";
import { claimLimitedClick, recordClick } from "@/lib/analytics";
import { buildShortUrl, displayShortUrl } from "@/lib/app-url";
import { config } from "@/lib/config";
import { resolveRequestDomain } from "@/lib/domains";
import { cloakHtml, previewCardHtml } from "@/lib/html";
import { loadRedirectLink } from "@/lib/link-cache";
import { enforceRateLimit, getClientIp, redirectLimiter } from "@/lib/rate-limit";
import {
  evaluateGates,
  forwardQueryParams,
  pickDestination,
  shouldServePreviewCard,
  visitSource,
  type RedirectLink,
} from "@/lib/redirect";
import { parseVisitor, type VisitorInfo } from "@/lib/visitor";

const AB_COOKIE_PREFIX = "lk_ab_";
const AB_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function decodeCode(raw: string): string {
  if (!/%[0-9a-f]{2}/i.test(raw)) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

export async function GET(request: Request, ctx: RouteContext<"/[shortCode]">) {
  return handle(request, ctx, true);
}

/** Link checkers send HEAD: answer with the redirect but never count a visit. */
export async function HEAD(request: Request, ctx: RouteContext<"/[shortCode]">) {
  return handle(request, ctx, false);
}

async function handle(request: Request, ctx: RouteContext<"/[shortCode]">, record: boolean) {
  const shortCode = decodeCode((await ctx.params).shortCode);

  if (!shortCode || Array.from(shortCode).length > 100) {
    return NextResponse.json({ error: "Invalid short code" }, { status: 400 });
  }

  const limit = await enforceRateLimit(
    redirectLimiter,
    getClientIp(request),
    "Too many requests. Please slow down.",
  );
  if (!limit.ok) return limit.response;

  try {
    const { domain, settings } = await resolveRequestDomain(request);
    const link = await loadRedirectLink(domain, shortCode);

    if (!link) {
      if (settings?.notFoundRedirect) return plainRedirect(settings.notFoundRedirect);
      return notice("/link-missing", shortCode, request);
    }

    const gate = evaluateGates(link);
    if (gate.kind === "banned") return notice("/link-blocked", shortCode, request);
    if (gate.kind === "disabled") return notice("/link-disabled", shortCode, request);
    if (gate.kind === "scheduled") {
      return notice("/link-scheduled", shortCode, request, {
        at: new Date(gate.startsAt).toISOString(),
      });
    }
    if (gate.kind === "expired") {
      return gate.fallback
        ? plainRedirect(gate.fallback)
        : notice("/link-expired", shortCode, request, { reason: "expired" });
    }

    const visitor = parseVisitor(request);
    const url = new URL(request.url);
    const source = visitSource(url.searchParams);
    const track = (destination: string | null, counted = false) => {
      if (!record) return;
      after(async () => {
        try {
          await recordClick({ link, visitor, source, destination, counted });
        } catch (err) {
          console.error("[redirect] Click recording failed:", err);
        }
      });
    };

    if (shouldServePreviewCard(link, visitor.isPreviewBot)) {
      track(null);
      return previewCard(link, request);
    }

    if (link.hasPassword) {
      const target = new URL(`/unlock/${encodeURIComponent(shortCode)}`, request.url);
      url.searchParams.forEach((value, key) => target.searchParams.append(key, value));
      return noStore(NextResponse.redirect(target, 302));
    }

    // Click limits count humans only, claimed atomically so two visitors to
    // a one-time link cannot both get through.
    let counted = false;
    if (link.maxClicks !== null && !visitor.isBot && record) {
      if (!(await claimLimitedClick(link.id, link.maxClicks))) {
        return link.expiredUrl
          ? plainRedirect(link.expiredUrl)
          : notice("/link-expired", shortCode, request, { reason: "limit" });
      }
      counted = true;
    }

    const cookieName = `${AB_COOKIE_PREFIX}${link.id}`;
    const sticky = Number.parseInt(readCookie(request, cookieName) ?? "", 10);
    const destination = pickDestination(link, {
      platform: visitor.platform,
      country: visitor.country,
      stickyVariant: Number.isNaN(sticky) ? null : sticky,
    });
    const target = link.forwardQuery
      ? forwardQueryParams(destination.url, url.searchParams)
      : destination.url;

    track(target, counted);

    const response = link.cloaked
      ? new NextResponse(
          cloakHtml({
            url: target,
            title: link.title ?? displayShortUrl(link.shortCode, { domain: link.domain }),
            hideReferrer: link.hideReferrer,
          }),
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        )
      : NextResponse.redirect(target, link.redirectType);

    decorate(response, link, visitor);
    for (const [key, value] of Object.entries(limit.headers)) response.headers.set(key, value);
    if (destination.variant !== null) {
      response.cookies.set(cookieName, String(destination.variant), {
        maxAge: AB_COOKIE_MAX_AGE,
        httpOnly: true,
        sameSite: "lax",
        path: `/${encodeURIComponent(shortCode)}`,
      });
    }
    return response;
  } catch (error) {
    console.error("[redirect] Failed to process redirect:", error);
    return NextResponse.json(
      { error: "Failed to process redirect. Please try again." },
      { status: 500 },
    );
  }
}

function decorate(response: NextResponse, link: RedirectLink, visitor: VisitorInfo) {
  // Temporary redirects must not be cached, or repeat visits skip analytics
  // and an edited destination keeps serving the old one. A 301/308 is the
  // owner's explicit choice to let browsers cache it.
  if (link.redirectType === 302 || link.redirectType === 307 || link.cloaked) {
    response.headers.set("Cache-Control", "private, no-cache, no-store, max-age=0");
  }
  // A Referrer-Policy on the redirect response applies to the next hop, so
  // the destination sees no referrer at all.
  if (link.hideReferrer) response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex");
  if (visitor.isBot) response.headers.set("Vary", "User-Agent");
}

function previewCard(link: RedirectLink, request: Request) {
  const shortUrl = buildShortUrl(link.shortCode, { domain: link.domain, request });
  const html = link.hasPassword
    ? previewCardHtml({
        title: link.ogTitle ?? "Password-protected link",
        description: link.ogDescription ?? "Open the link and enter the password to continue.",
        image: link.ogImage,
        url: shortUrl,
        siteName: config.siteName,
      })
    : previewCardHtml({
        title: link.ogTitle ?? link.title ?? shortUrl,
        description: link.ogDescription,
        image: link.ogImage,
        url: shortUrl,
        siteName: config.siteName,
      });
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}

function plainRedirect(target: string) {
  return noStore(NextResponse.redirect(target, 302));
}

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/**
 * Send visitors to a real, routable notice page.
 *
 * `not-found.tsx` is an App Router convention file, not a URL: it compiles to
 * the internal `_not-found` entry, so `/not-found` has no static route and
 * falls through to this very `/[shortCode]` handler. Redirecting there looked
 * up a link named "not-found", missed, and redirected again - an infinite 302
 * loop. The notice pages are real routes, which take precedence over the
 * dynamic segment, so the loop cannot recur.
 */
function notice(path: string, shortCode: string, request: Request, extra?: Record<string, string>) {
  const target = new URL(path, request.url);
  target.searchParams.set("code", shortCode);
  for (const [key, value] of Object.entries(extra ?? {})) target.searchParams.set(key, value);
  // Never let a browser or CDN cache the verdict: the owner may create,
  // renew or re-enable that short code at any time.
  return noStore(NextResponse.redirect(target, 302));
}

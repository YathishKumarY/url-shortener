import { cache } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Ban,
  ChartColumn,
  CirclePause,
  CircleSlash,
  Eye,
  Hourglass,
  Lock,
  QrCode,
  Route,
  SearchX,
  ShieldCheck,
  Split,
  type LucideIcon,
} from "lucide-react";
import { Footer } from "@/components/landing/footer";
import { CopyIconButton } from "@/components/public/copy-button";
import { Eyebrow } from "@/components/public/eyebrow";
import { LocalTime } from "@/components/public/local-time";
import { NoticeBackdrop, NoticeContent, type NoticeTone } from "@/components/public/notice-layout";
import { decodeCode, isPlausibleCode } from "@/components/public/params";
import { PillLink } from "@/components/public/pill-link";
import { ReportDialog } from "@/components/public/report-dialog";
import { requestNamespace } from "@/components/public/request";
import { mono } from "@/components/public/styles";
import { Navbar } from "@/components/shared/navbar";
import { Favicon, Panel, StatusBadge } from "@/components/shared/ui-kit";
import { buildShortUrl, displayShortUrl } from "@/lib/app-url";
import { countryName } from "@/lib/countries";
import { formatNumber, hostnameOf } from "@/lib/format";
import { linkStatus } from "@/lib/links";
import { prisma } from "@/lib/prisma";
import { parseGeoTargets, parseVariants } from "@/lib/redirect";
import { cn } from "@/lib/utils";
import type { LinkStatus } from "@/types";
import type { Metadata } from "next";

type PageProps = { params: Promise<{ code: string }> };

/**
 * `/{code}+` lands here (src/proxy.ts rewrites it): where a short link goes,
 * whether it still works, and a way to report it - without redirecting.
 *
 * Shared by the page and generateMetadata through React's per-request cache.
 */
const loadPreview = cache(async (rawCode: string) => {
  const code = decodeCode(rawCode);
  const { request, domain } = await requestNamespace();
  const link = isPlausibleCode(code)
    ? await prisma.link.findUnique({
        where: { domain_shortCode: { domain, shortCode: code } },
        include: { user: { select: { bannedAt: true } } },
      })
    : null;
  return { code, domain, request, link };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { link, request } = await loadPreview((await params).code);
  const robots = { index: false, follow: false };
  if (!link) return { title: "Link not found", robots };
  const display = displayShortUrl(link.shortCode, { domain: link.domain || null, request });
  return {
    title: `Preview of ${display}`,
    description: `See where ${display} goes before you open it.`,
    robots,
  };
}

const BACKDROP: Record<LinkStatus, NoticeTone> = {
  active: "blue",
  scheduled: "blue",
  expired: "amber",
  limited: "amber",
  disabled: "gray",
  banned: "red",
};

const NOTE_TONES = {
  blue: "border-blue-500/25 bg-blue-500/8 text-blue-800 dark:text-blue-200",
  amber: "border-amber-500/25 bg-amber-500/8 text-amber-800 dark:text-amber-200",
  gray: "border-zinc-500/25 bg-zinc-500/8 text-zinc-700 dark:text-zinc-200",
  red: "border-red-500/25 bg-red-500/8 text-red-800 dark:text-red-200",
} as const;

function StatusNote({
  tone,
  icon: Icon,
  children,
}: {
  tone: keyof typeof NOTE_TONES;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed",
        NOTE_TONES[tone],
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function PanelTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <h2 className="text-foreground flex items-center gap-3 text-[15px] font-semibold">
      <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4" aria-hidden />
      </span>
      {children}
    </h2>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-foreground mt-0.5 text-sm font-medium tabular-nums">{children}</dd>
    </div>
  );
}

function PreviewShell({ tone, children }: { tone: NoticeTone; children: React.ReactNode }) {
  return (
    <div className="bg-background relative flex min-h-dvh flex-col overflow-x-clip">
      <NoticeBackdrop tone={tone} />
      <Navbar />
      <main className="relative z-10 flex-1 px-4 pt-2 pb-24 sm:px-6 md:px-12">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

export default async function PreviewPage({ params }: PageProps) {
  const { code, domain, request, link } = await loadPreview((await params).code);

  if (!link) {
    return (
      <PreviewShell tone="blue">
        <div className="flex justify-center py-10 sm:py-16">
          <NoticeContent
            tone="blue"
            icon={SearchX}
            title="Link not found"
            description="There is no short link at this address. It may have been deleted, or the address was mistyped."
            shortLink={displayShortUrl(code, { domain: domain || null, request })}
            actions={
              <>
                <PillLink href="/">
                  Shorten a new link
                  <ArrowRight />
                </PillLink>
                <PillLink href="/" variant="secondary">
                  Back to home
                </PillLink>
              </>
            }
          />
        </div>
      </PreviewShell>
    );
  }

  // A banned owner takes all of their links down with them.
  const status: LinkStatus = link.user?.bannedAt ? "banned" : linkStatus(link);
  const banned = status === "banned";
  const locked = !!link.password;
  const urlOptions = { domain: link.domain || null, request };
  const shortUrl = buildShortUrl(link.shortCode, urlOptions);
  const display = displayShortUrl(link.shortCode, urlOptions);
  const encoded = encodeURIComponent(link.shortCode);
  const domainQuery = link.domain ? `domain=${encodeURIComponent(link.domain)}` : "";
  const statsHref = `/stats/${encoded}${domainQuery ? `?${domainQuery}` : ""}`;
  const qrSrc = `/api/qr/${encoded}?size=320${domainQuery ? `&${domainQuery}` : ""}`;

  const canContinue = status === "active";
  // Password links go through the short URL so the unlock flow runs; the
  // destination itself must never reach this page's HTML.
  const continueHref = locked ? shortUrl : link.originalUrl;
  const showQr = status === "active" || status === "scheduled";
  const host = hostnameOf(link.originalUrl);
  const heading = link.title?.trim() || host;

  // Device, country and A/B rules can send visitors somewhere other than
  // `originalUrl`; a preview that hid them would defeat its purpose.
  const alternates: Array<{ label: string; url: string }> = [];
  if (!locked && !banned) {
    if (link.iosUrl) alternates.push({ label: "On iPhone and iPad", url: link.iosUrl });
    if (link.androidUrl) alternates.push({ label: "On Android", url: link.androidUrl });
    for (const [country, url] of Object.entries(parseGeoTargets(link.geoTargets) ?? {})) {
      alternates.push({ label: `Visitors in ${countryName(country)}`, url });
    }
    const variants = parseVariants(link.abVariants);
    if (variants) {
      const total = variants.reduce((sum, v) => sum + v.weight, 0);
      variants.forEach((variant, index) => {
        const share = Math.round((variant.weight / total) * 100);
        alternates.push({
          label: `A/B variant ${String.fromCharCode(65 + index)} (${share}% of visitors)`,
          url: variant.url,
        });
      });
    }
  }
  const shownAlternates = alternates.slice(0, 8);

  const fallback = link.expiredUrl ? (
    <>
      {" "}
      Visitors are sent to a fallback page on{" "}
      <span className="font-semibold break-all">{hostnameOf(link.expiredUrl)}</span> instead.
    </>
  ) : null;

  const note =
    status === "expired" && link.expiresAt ? (
      <StatusNote tone="amber" icon={Hourglass}>
        This link expired on{" "}
        <LocalTime value={link.expiresAt.toISOString()} className="font-semibold" />, so it no
        longer opens.{fallback}
      </StatusNote>
    ) : status === "limited" && link.maxClicks !== null ? (
      <StatusNote tone="amber" icon={CircleSlash}>
        {link.maxClicks === 1
          ? "This was a one-time link and it has already been used, so it no longer opens."
          : `This link reached its limit of ${formatNumber(link.maxClicks)} clicks, so it no longer opens.`}
        {fallback}
      </StatusNote>
    ) : status === "scheduled" && link.startsAt ? (
      <StatusNote tone="blue" icon={Hourglass}>
        This link opens on{" "}
        <LocalTime value={link.startsAt.toISOString()} className="font-semibold" />. Until then,
        visitors see a countdown.
      </StatusNote>
    ) : status === "disabled" ? (
      <StatusNote tone="gray" icon={CirclePause}>
        The owner has paused this link. It does not send visitors anywhere until they switch it back
        on.
      </StatusNote>
    ) : null;

  return (
    <PreviewShell tone={BACKDROP[status]}>
      <header className="flex flex-col items-center pt-4 pb-10 text-center sm:pt-8">
        <Eyebrow icon={Eye}>Link preview</Eyebrow>
        <div className="mt-5 flex max-w-full items-center justify-center gap-3">
          <h1 className="gradient-title min-w-0 text-[28px] leading-tight font-extrabold tracking-tight break-all sm:text-5xl sm:leading-tight">
            {display}
          </h1>
          <CopyIconButton
            text={shortUrl}
            label="Copy short link"
            toastMessage="Short link copied"
          />
        </div>
        <p className="text-muted-foreground mt-3 max-w-lg text-[15px] leading-relaxed">
          See where this short link goes before you open it.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 space-y-5">
          <Panel className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <PanelTitle icon={Route}>Where this link goes</PanelTitle>
              <StatusBadge status={status} />
            </div>

            <div className="mt-5 space-y-5">
              {banned ? (
                <StatusNote tone="red" icon={Ban}>
                  This link was blocked for violating our terms of service. It no longer opens, and
                  its destination is hidden for your safety.
                </StatusNote>
              ) : locked ? (
                <div className="border-border/70 flex items-start gap-3 rounded-xl border border-dashed p-4">
                  <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                    <Lock className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-foreground font-semibold">Destination hidden</p>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                      This link is password protected. Its owner keeps the destination private until
                      you enter the password, which you will be asked for when you continue.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3">
                    <Favicon url={link.originalUrl} className="size-10 rounded-xl p-1" />
                    <div className="min-w-0">
                      <p className="text-foreground truncate text-base font-semibold">{heading}</p>
                      {heading !== host && (
                        <p className="text-muted-foreground truncate text-sm">{host}</p>
                      )}
                    </div>
                  </div>
                  <p
                    className={cn(
                      mono,
                      "border-border/60 bg-secondary/60 text-foreground mt-4 rounded-xl border px-4 py-3 text-[13px] leading-relaxed break-all",
                    )}
                  >
                    {link.originalUrl}
                  </p>
                </div>
              )}

              {shownAlternates.length > 0 && (
                <div>
                  <p className="text-foreground flex items-center gap-2 text-sm font-semibold">
                    <Split className="text-muted-foreground size-4" aria-hidden />
                    Some visitors are sent elsewhere
                  </p>
                  <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
                    Depending on their device, location or an A/B test, visitors may land on one of
                    these pages instead.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {shownAlternates.map((alternate) => (
                      <li
                        key={`${alternate.label}-${alternate.url}`}
                        className="border-border/60 rounded-xl border px-3 py-2"
                      >
                        <span className="text-muted-foreground block text-xs font-medium">
                          {alternate.label}
                        </span>
                        <span className={cn(mono, "text-foreground block text-[13px] break-all")}>
                          {alternate.url}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {alternates.length > shownAlternates.length && (
                    <p className="text-muted-foreground mt-2 text-xs">
                      And {alternates.length - shownAlternates.length} more.
                    </p>
                  )}
                </div>
              )}

              {note}
            </div>

            <dl className="border-border/60 mt-5 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-3">
              <Meta label="Created">
                <LocalTime value={link.createdAt.toISOString()} withTime={false} />
              </Meta>
              {link.expiresAt && status !== "expired" && !banned && (
                <Meta label="Expires">
                  <LocalTime value={link.expiresAt.toISOString()} withTime={false} />
                </Meta>
              )}
              {link.publicStats && !banned && (
                <Meta label="Clicks">{formatNumber(link.clickCount)}</Meta>
              )}
            </dl>
          </Panel>

          {banned ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <PillLink href="/">Back to home</PillLink>
              <PillLink href="/docs#abuse" variant="secondary">
                How we handle abuse
              </PillLink>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {canContinue && (
                <PillLink href={continueHref} native rel="nofollow noreferrer">
                  {locked && <Lock />}
                  Continue to site
                  <ArrowUpRight />
                </PillLink>
              )}
              {link.publicStats && (
                <PillLink href={statsHref} variant="secondary">
                  <ChartColumn />
                  View stats
                </PillLink>
              )}
              <ReportDialog
                code={link.shortCode}
                domain={link.domain}
                displayUrl={display}
                className="sm:ml-auto"
              />
            </div>
          )}
        </div>

        <aside className="min-w-0 space-y-5">
          {showQr && (
            <Panel className="p-5">
              <PanelTitle icon={QrCode}>Open on your phone</PanelTitle>
              <div className="mt-4 flex justify-center">
                {/* White plate: the code needs a light surround to scan in dark mode. */}
                <div className="rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrSrc}
                    alt={`QR code for ${display}`}
                    width={176}
                    height={176}
                    decoding="async"
                    className="block size-44"
                  />
                </div>
              </div>
              <p className="text-muted-foreground mt-3 text-center text-xs leading-relaxed">
                Scan with your camera to open this link on another device.
              </p>
            </Panel>
          )}

          <Panel className="p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-green-500/12 text-green-700 dark:text-green-400">
                <ShieldCheck className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="text-foreground text-sm font-semibold">
                  Check the destination before continuing
                </h2>
                <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
                  {locked
                    ? "This link hides where it goes until you enter the password. Only continue if you trust whoever shared it, and check the address bar once the page opens."
                    : "Short links can lead anywhere. Make sure the address above belongs to a site you trust, and never enter passwords or payment details on a page you did not expect."}
                </p>
              </div>
            </div>
          </Panel>
        </aside>
      </div>
    </PreviewShell>
  );
}

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BioAvatar } from "@/components/bio/bio-avatar";
import { BioFavicon } from "@/components/bio/bio-favicon";
import { BioShareButton } from "@/components/bio/bio-share-button";
import { SOCIAL_PLATFORMS, socialHref, type BioSocials } from "@/components/bio/socials";
import { BIO_THEME_LIST, getBioTheme, GRAIN_TEXTURE, type BioTheme } from "@/components/bio/themes";
import { faviconSrc, initialsFor, safeImageUrl } from "@/components/bio/utils";
import { LinklyIcon } from "@/components/shared/linkly-icon";
import { cn } from "@/lib/utils";

export interface BioProfileLink {
  id: string;
  /** Button label: the link title, or the destination hostname. */
  title: string;
  /** Destination URL, used for the favicon. */
  url: string;
  /** Where the button goes (the short URL). Omitted in the editor preview. */
  href?: string;
}

export interface BioProfileProps {
  /**
   * "page" renders the real, interactive page on a fixed full-viewport
   * canvas. "preview" renders an inert copy that fills its container (the
   * editor's phone frame) and scrolls internally.
   */
  variant?: "page" | "preview";
  slug: string;
  displayName?: string | null;
  bio?: string | null;
  /** Already resolved (bio avatar, else account photo). */
  avatarUrl?: string | null;
  theme?: string | null;
  socials?: BioSocials | null;
  links: BioProfileLink[];
}

/*
 * Staggered entrance: opacity plus a small rise, skipped for reduced motion.
 * Applied to the glass element itself, never to a wrapper: an ancestor with
 * opacity below 1 becomes a backdrop root and would switch the blur off
 * mid-animation. The delay is set inline because tw-animate's `delay-*` also
 * sets transition-delay, which would make hover feel sluggish.
 */
const ENTER =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both motion-safe:animation-duration-500";

function enterDelay(ms: number) {
  return { animationDelay: `${ms}ms` };
}

const FOCUS_RING = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2";
const LINKS_START = 220;
const STAGGER = 60;

/** The theme's canvas: layered gradients plus optional film grain. */
export function BioBackdrop({ theme, className }: { theme: BioTheme; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none inset-0 -z-10 overflow-hidden", className)}
      style={{ background: theme.canvas }}
    >
      {theme.grain > 0 && (
        <div
          className="absolute inset-0 mix-blend-overlay"
          style={{ backgroundImage: GRAIN_TEXTURE, opacity: theme.grain }}
        />
      )}
    </div>
  );
}

export function BioProfile({
  variant = "page",
  slug,
  displayName,
  bio,
  avatarUrl,
  theme: themeId,
  socials,
  links,
}: BioProfileProps) {
  const theme = getBioTheme(themeId);
  const t = theme.classes;
  const isPage = variant === "page";

  const handle = slug || "yourname";
  const trimmedName = displayName?.trim();
  const name = trimmedName || `@${handle}`;
  const bioText = bio?.trim();
  const avatar = safeImageUrl(avatarUrl);
  const socialLinks = SOCIAL_PLATFORMS.flatMap((platform) => {
    const href = socialHref(platform.key, socials?.[platform.key]);
    return href ? [{ ...platform, href }] : [];
  });

  const Heading = isPage ? "h1" : "p";
  const LinksRegion = isPage ? "nav" : "div";
  const footerDelay = LINKS_START + Math.min(Math.max(links.length, 1), 8) * STAGGER + 60;
  const textTransition = isPage ? "" : "transition-colors duration-500";

  const footerInner = (
    <>
      <LinklyIcon className="size-4" />
      <span>
        Made with <span className={cn("font-semibold", t.name)}>Linkly</span>
      </span>
    </>
  );
  const footerClasses = cn(
    "inline-flex h-9 items-center gap-2 rounded-full pr-3.5 pl-3 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200",
    t.footer,
    ENTER,
  );

  const content = (
    <>
      <header className="flex flex-col items-center text-center">
        <div
          className={cn(
            "rounded-full p-[3px] shadow-[0_14px_36px_-16px_rgba(0,0,0,0.45)]",
            t.avatarRing,
            ENTER,
          )}
          style={enterDelay(0)}
        >
          <div
            className="rounded-full p-[3px] transition-[background-color] duration-500"
            style={{ backgroundColor: theme.ringGap }}
          >
            <BioAvatar
              src={avatar}
              initials={initialsFor(trimmedName || handle)}
              className="size-24 text-[1.75rem]"
              imageClassName={t.avatarImage}
              fallbackClassName={t.avatarFallback}
            />
          </div>
        </div>

        <Heading
          className={cn(
            "mt-5 max-w-full text-[1.375rem] leading-tight font-bold tracking-tight text-balance wrap-anywhere",
            t.name,
            textTransition,
            ENTER,
          )}
          style={enterDelay(60)}
        >
          {name}
        </Heading>

        {trimmedName && (
          <p
            className={cn("mt-1 text-sm font-medium", t.handle, textTransition, ENTER)}
            style={enterDelay(100)}
          >
            @{handle}
          </p>
        )}

        {bioText && (
          <p
            className={cn(
              "mt-3 max-w-[36ch] text-[15px] leading-relaxed text-pretty wrap-anywhere whitespace-pre-line",
              t.bio,
              textTransition,
              ENTER,
            )}
            style={enterDelay(140)}
          >
            {bioText}
          </p>
        )}

        {socialLinks.length > 0 && (
          <ul
            aria-label="Social profiles"
            className="mt-5 flex max-w-[22rem] flex-wrap justify-center gap-2"
          >
            {socialLinks.map((social, index) => {
              const Icon = social.icon;
              const classes = cn(
                "flex size-11 items-center justify-center rounded-full transition-[translate,scale,background-color,color,box-shadow] duration-200 ease-out",
                t.social,
                ENTER,
              );
              const delay = enterDelay(180 + index * 30);
              return (
                <li key={social.key}>
                  {isPage ? (
                    <a
                      href={social.href}
                      rel="me nofollow noopener"
                      aria-label={social.label}
                      title={social.label}
                      style={delay}
                      className={cn(
                        classes,
                        FOCUS_RING,
                        t.focus,
                        "active:scale-[0.96] motion-safe:hover:-translate-y-0.5",
                      )}
                    >
                      <Icon aria-hidden className="size-[18px]" />
                    </a>
                  ) : (
                    <span title={social.label} style={delay} className={classes}>
                      <Icon aria-hidden className="size-[18px]" />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </header>

      <LinksRegion aria-label={isPage ? "Links" : undefined} className="mt-8">
        {links.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {links.map((link, index) => {
              const inner = (
                <>
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-[10px] shadow-[0_1px_2px_rgba(0,0,0,0.12)]",
                      t.linkIcon,
                    )}
                  >
                    <BioFavicon src={faviconSrc(link.url)} />
                  </span>
                  <span className="line-clamp-2 min-w-0 flex-1 text-center text-[15px] leading-snug font-semibold wrap-anywhere">
                    {link.title}
                  </span>
                  {/* Mirrors the favicon chip so the title stays optically centred. */}
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center">
                    <ArrowUpRight
                      className={cn(
                        "size-[18px] -translate-x-1 translate-y-1 opacity-0 transition-[opacity,translate] duration-200 ease-out group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:translate-y-0 group-focus-visible:opacity-100",
                        t.linkArrow,
                      )}
                    />
                  </span>
                </>
              );
              const classes = cn(
                "group relative flex min-h-[60px] w-full items-center gap-3 rounded-[20px] p-2.5 transition-[translate,scale,background-color,color,box-shadow] duration-200 ease-out",
                t.link,
                ENTER,
              );
              const delay = enterDelay(LINKS_START + Math.min(index, 8) * STAGGER);
              return (
                <li key={link.id}>
                  {isPage && link.href ? (
                    <a
                      href={link.href}
                      rel="nofollow noopener"
                      style={delay}
                      className={cn(
                        classes,
                        FOCUS_RING,
                        t.focus,
                        "active:scale-[0.98] motion-safe:hover:-translate-y-0.5",
                      )}
                    >
                      {inner}
                    </a>
                  ) : (
                    <div style={delay} className={classes}>
                      {inner}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : !isPage ? (
          <div className="flex flex-col gap-3">
            {[1, 0.6, 0.3].map((opacity, index) => (
              <div
                key={opacity}
                style={{ opacity }}
                className={cn(
                  "flex min-h-[60px] items-center justify-center rounded-[20px] border border-dashed px-4 text-[13px] font-medium transition-colors duration-500",
                  t.placeholder,
                )}
              >
                {index === 0 ? "Featured links will appear here" : null}
              </div>
            ))}
          </div>
        ) : null}
      </LinksRegion>

      <footer className="mt-auto flex justify-center pt-12">
        {isPage ? (
          <Link
            href="/"
            prefetch={false}
            style={enterDelay(footerDelay)}
            className={cn(footerClasses, FOCUS_RING, t.focus)}
          >
            {footerInner}
          </Link>
        ) : (
          <span style={enterDelay(footerDelay)} className={footerClasses}>
            {footerInner}
          </span>
        )}
      </footer>
    </>
  );

  if (!isPage) {
    return (
      <div
        className="relative isolate h-full overflow-hidden antialiased"
        style={{ colorScheme: theme.scheme }}
      >
        {/* Every canvas stays mounted so switching themes cross-fades. */}
        {BIO_THEME_LIST.map((item) => (
          <BioBackdrop
            key={item.id}
            theme={item}
            className={cn(
              "absolute transition-opacity duration-500 ease-out",
              item.id === theme.id ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
        <div className="scrollbar-none relative h-full overflow-y-auto overscroll-contain">
          <div className="mx-auto flex min-h-full w-full max-w-[480px] flex-col px-5 pt-16 pb-8">
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-bio-theme={theme.id}
      className="relative isolate min-h-dvh overflow-x-clip antialiased"
      style={{ colorScheme: theme.scheme }}
    >
      <BioBackdrop theme={theme} className="fixed" />
      <main className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pt-16 pb-8 sm:pt-24">
        <BioShareButton
          path={`/@${handle}`}
          title={name}
          className={cn("absolute top-4 right-4 sm:top-6", t.social, t.focus)}
        />
        {content}
      </main>
    </div>
  );
}

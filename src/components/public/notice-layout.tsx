import Link from "next/link";
import { LinkIcon, type LucideIcon } from "lucide-react";
import { mono } from "@/components/public/styles";
import { cn } from "@/lib/utils";

/**
 * The full-page notice look shared by /link-expired, /link-missing,
 * /link-scheduled, /link-disabled, /link-blocked and /unlock: a centred
 * column over soft colour blobs, an icon in concentric circles, the short
 * link in a chip and pill actions underneath.
 *
 * No hooks and no "use client", so server pages and client components can
 * both render it. Pass icons as components (`icon={Clock}`).
 */

export type NoticeTone = "blue" | "pink" | "amber" | "red" | "gray";

const TONES: Record<
  NoticeTone,
  { halo: string; core: string; icon: string; blob: string; chip: string; badge: string }
> = {
  blue: {
    halo: "bg-[#144ee3]/10",
    core: "bg-[#144ee3]/15",
    icon: "text-primary",
    blob: "bg-[#144ee3]/5",
    chip: "bg-[#144ee3]/5 dark:bg-[#144ee3]/10",
    badge: "bg-[#144ee3]/20 text-primary",
  },
  pink: {
    halo: "bg-[#eb568e]/10",
    core: "bg-[#eb568e]/15",
    icon: "text-[#eb568e]",
    blob: "bg-[#eb568e]/5",
    chip: "bg-[#eb568e]/5 dark:bg-[#eb568e]/10",
    badge: "bg-[#eb568e]/20 text-[#eb568e]",
  },
  amber: {
    halo: "bg-[#b0901e]/10",
    core: "bg-[#b0901e]/15",
    icon: "text-[#b0901e]",
    blob: "bg-[#b0901e]/5",
    chip: "bg-[#b0901e]/5 dark:bg-[#b0901e]/10",
    badge: "bg-[#b0901e]/20 text-[#b0901e]",
  },
  red: {
    halo: "bg-red-500/10",
    core: "bg-red-500/15",
    icon: "text-red-600 dark:text-red-400",
    blob: "bg-red-500/5",
    chip: "bg-red-500/5 dark:bg-red-500/10",
    badge: "bg-red-500/20 text-red-600 dark:text-red-400",
  },
  gray: {
    halo: "bg-zinc-500/10",
    core: "bg-zinc-500/15",
    icon: "text-zinc-600 dark:text-zinc-300",
    blob: "bg-zinc-500/5",
    chip: "bg-zinc-500/5 dark:bg-zinc-500/10",
    badge: "bg-zinc-500/20 text-zinc-600 dark:text-zinc-300",
  },
};

/** Two soft colour blobs behind the page. The parent must be `relative`. */
export function NoticeBackdrop({ tone = "blue" }: { tone?: NoticeTone }) {
  const accent = tone === "blue" ? TONES.pink.blob : TONES.blue.blob;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className={cn(
          "absolute top-1/4 left-1/4 size-[300px] rounded-full blur-[100px]",
          TONES[tone].blob,
        )}
      />
      <div
        className={cn(
          "absolute right-1/4 bottom-1/4 size-[300px] rounded-full blur-[100px]",
          accent,
        )}
      />
    </div>
  );
}

export function NoticeIcon({
  icon: Icon,
  tone = "blue",
  badge: Badge,
  badgeTone = "amber",
}: {
  icon: LucideIcon;
  tone?: NoticeTone;
  badge?: LucideIcon;
  badgeTone?: NoticeTone;
}) {
  return (
    <div className="relative" aria-hidden>
      <div
        className={cn("flex size-24 items-center justify-center rounded-full", TONES[tone].halo)}
      >
        <div
          className={cn("flex size-16 items-center justify-center rounded-full", TONES[tone].core)}
        >
          <Icon className={cn("size-8", TONES[tone].icon)} />
        </div>
      </div>
      {Badge && (
        <span className="bg-background absolute -right-1 -bottom-1 flex size-9 items-center justify-center rounded-full">
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full",
              TONES[badgeTone].badge,
            )}
          >
            <Badge className="size-4" />
          </span>
        </span>
      )}
    </div>
  );
}

/** The short link a notice is about, e.g. "linkly.app/launch". */
export function NoticeLinkChip({ value, tone = "blue" }: { value: string; tone?: NoticeTone }) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5",
        TONES[tone].chip,
      )}
    >
      <LinkIcon className={cn("size-4 shrink-0", TONES[tone].icon)} aria-hidden />
      <span className={cn(mono, "text-card-foreground min-w-0 text-sm break-all")}>{value}</span>
    </div>
  );
}

/** Numbered "What you can do" suggestions. */
export function NoticeSteps({
  title = "What you can do",
  steps,
}: {
  title?: string;
  steps: React.ReactNode[];
}) {
  return (
    <div className="w-full space-y-3">
      <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">{title}</p>
      <ol className="space-y-2 text-left">
        {steps.map((step, index) => (
          <li
            key={index}
            className="border-border/60 bg-card/70 shadow-soft flex items-start gap-3 rounded-xl border p-3 backdrop-blur-sm"
          >
            <span className="bg-primary/10 text-primary mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums">
              {index + 1}
            </span>
            <p className="text-card-foreground text-sm leading-relaxed">{step}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export interface NoticeContentProps {
  icon: LucideIcon;
  tone?: NoticeTone;
  badge?: LucideIcon;
  badgeTone?: NoticeTone;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Short link shown in the chip under the description. */
  shortLink?: string | null;
  /** Extra content between the chip and the actions (steps, a countdown, a form). */
  children?: React.ReactNode;
  /** Pill buttons. Stacked full width on phones, in a row from `sm` up. */
  actions?: React.ReactNode;
  footnote?: React.ReactNode;
  className?: string;
}

/** The centred notice column on its own, for pages that bring their own chrome. */
export function NoticeContent({
  icon,
  tone = "blue",
  badge,
  badgeTone,
  title,
  description,
  shortLink,
  children,
  actions,
  footnote,
  className,
}: NoticeContentProps) {
  return (
    <div
      className={cn(
        "relative z-10 flex w-full max-w-md flex-col items-center text-center",
        className,
      )}
    >
      <div className="mb-8">
        <NoticeIcon icon={icon} tone={tone} badge={badge} badgeTone={badgeTone} />
      </div>
      <h1 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl">
        {title}
      </h1>
      {description && (
        <p className="text-muted-foreground mt-4 max-w-sm text-base leading-relaxed">
          {description}
        </p>
      )}
      {shortLink && (
        <div className="mt-8 w-full">
          <NoticeLinkChip value={shortLink} tone={tone} />
        </div>
      )}
      {children && <div className="mt-8 w-full">{children}</div>}
      {actions && (
        <div className="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
          {actions}
        </div>
      )}
      {footnote && (
        <p className="text-muted-foreground mt-8 max-w-sm text-xs leading-relaxed">{footnote}</p>
      )}
    </div>
  );
}

/** A complete notice page: backdrop, brand mark and the centred column. */
export function NoticeLayout(props: NoticeContentProps) {
  return (
    <div className="bg-background relative flex min-h-dvh flex-col overflow-x-clip">
      <NoticeBackdrop tone={props.tone} />
      <header className="relative z-10 flex justify-center px-6 pt-8 sm:justify-start md:px-12">
        <Link
          href="/"
          aria-label="Linkly home"
          className="focus-visible:ring-ring/50 flex items-baseline rounded-md outline-none focus-visible:ring-3"
        >
          <span className="gradient-logo text-2xl font-extrabold">Linkly</span>
          <span className="text-foreground/50 -mt-2 -ml-0.5 text-[10px]">®</span>
        </Link>
      </header>
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pt-10 pb-24 sm:pb-16">
        <NoticeContent {...props} />
      </main>
    </div>
  );
}

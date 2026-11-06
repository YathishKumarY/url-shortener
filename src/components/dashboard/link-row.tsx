"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CalendarClock,
  Check,
  Copy,
  CornerDownRight,
  EyeOff,
  Frame,
  Ghost,
  Globe2,
  Hash,
  Lock,
  MessageSquareQuote,
  MousePointerClick,
  Smartphone,
  Split,
  Timer,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { LinkActionsMenu } from "@/components/dashboard/link-actions";
import { Favicon, StatusBadge, TagChip } from "@/components/shared/ui-kit";
import { compactNumber, formatDate, formatDateTime, hostnameOf, timeAgo } from "@/lib/format";
import { cn, copyToClipboard } from "@/lib/utils";
import type { LinkItem } from "@/types";

export function CopyIconButton({
  text,
  label = "Copy short link",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      title={label}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await copyToClipboard(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className={cn(
        "copy-btn-bg text-card-foreground hover:text-foreground relative inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full transition-[color,transform] duration-150 active:scale-[0.92]",
        className,
      )}
    >
      <Copy
        className="absolute size-3.5 transition-[opacity,transform,filter] duration-200"
        style={{
          opacity: copied ? 0 : 1,
          transform: copied ? "scale(0.3)" : "scale(1)",
          filter: copied ? "blur(3px)" : "none",
        }}
      />
      <Check
        className="absolute size-3.5 text-green-500 transition-[opacity,transform,filter] duration-200"
        style={{
          opacity: copied ? 1 : 0,
          transform: copied ? "scale(1)" : "scale(0.3)",
          filter: copied ? "none" : "blur(3px)",
        }}
      />
    </button>
  );
}

interface Feature {
  icon: LucideIcon;
  label: string;
}

/** Small icons summarising which advanced options a link uses. */
export function linkFeatures(link: LinkItem): Feature[] {
  const features: Feature[] = [];
  if (link.hasPassword) features.push({ icon: Lock, label: "Password protected" });
  if (link.expiresAt) {
    const past = new Date(link.expiresAt) <= new Date();
    features.push({
      icon: Timer,
      label: `${past ? "Expired" : "Expires"} ${formatDateTime(link.expiresAt)}`,
    });
  }
  if (link.startsAt && new Date(link.startsAt) > new Date()) {
    features.push({ icon: CalendarClock, label: `Goes live ${formatDateTime(link.startsAt)}` });
  }
  if (link.maxClicks !== null) {
    features.push({ icon: Hash, label: `${link.clickCount} of ${link.maxClicks} clicks used` });
  }
  if (link.iosUrl || link.androidUrl)
    features.push({ icon: Smartphone, label: "Device targeting" });
  if (link.geoTargets) {
    features.push({
      icon: Globe2,
      label: `Geo targeting (${Object.keys(link.geoTargets).length} countries)`,
    });
  }
  if (link.abVariants)
    features.push({ icon: Split, label: `A/B test (${link.abVariants.length} variants)` });
  if (link.ogTitle || link.ogImage || link.ogDescription) {
    features.push({ icon: MessageSquareQuote, label: "Custom social preview" });
  }
  if (link.hideReferrer) features.push({ icon: EyeOff, label: "Referrer hidden" });
  if (link.cloaked) features.push({ icon: Frame, label: "Cloaked" });
  if (link.noLog) features.push({ icon: Ghost, label: "No visitor logging" });
  if (link.publicStats) features.push({ icon: BarChart3, label: "Public stats" });
  if (link.bioPinned) features.push({ icon: UserRound, label: "On bio page" });
  return features;
}

function FeatureIcons({ link }: { link: LinkItem }) {
  const features = linkFeatures(link);
  if (features.length === 0) return null;
  return (
    <span className="flex items-center gap-1">
      {features.map(({ icon: Icon, label }) => (
        <span
          key={label}
          title={label}
          aria-label={label}
          className="bg-secondary text-muted-foreground inline-flex size-6 items-center justify-center rounded-full"
        >
          <Icon className="size-3" />
        </span>
      ))}
    </span>
  );
}

function SelectBox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors",
        checked
          ? "bg-primary border-primary text-white"
          : "border-border hover:border-card-foreground bg-transparent text-transparent",
      )}
    >
      <Check className="size-3" strokeWidth={3} />
    </button>
  );
}

export { SelectBox };

interface LinkRowProps {
  link: LinkItem;
  selected: boolean;
  onToggleSelect: () => void;
}

export function LinkRow({ link, selected, onToggleSelect }: LinkRowProps) {
  const label = link.title || hostnameOf(link.originalUrl);
  const limitPct = link.maxClicks ? Math.min(100, (link.clickCount / link.maxClicks) * 100) : null;

  return (
    <div
      className={cn(
        "group hover:bg-secondary/40 relative flex items-center gap-3 px-4 py-3.5 transition-colors sm:gap-4 sm:px-5",
        selected && "bg-primary/[0.06] hover:bg-primary/[0.09]",
        link.archived && "opacity-70",
      )}
    >
      <SelectBox checked={selected} onChange={onToggleSelect} label={`Select ${link.displayUrl}`} />

      <Favicon url={link.originalUrl} size={32} className="hidden size-10 sm:block" />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/dashboard/links/${link.id}`}
            className="text-foreground truncate text-[15px] font-semibold hover:underline"
            title={label}
          >
            {label}
          </Link>
          <span className="hidden shrink-0 md:inline-flex">
            <FeatureIcons link={link} />
          </span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          <a
            href={link.shortUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary truncate text-sm font-medium hover:underline"
          >
            {link.displayUrl}
          </a>
          <CopyIconButton text={link.shortUrl} />
        </div>
        <div className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1 text-xs">
          <CornerDownRight className="size-3 shrink-0" />
          <span className="truncate" title={link.originalUrl}>
            {link.originalUrl.replace(/^https?:\/\//, "")}
          </span>
        </div>
        {(link.tags.length > 0 || limitPct !== null) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {link.tags.map((tag) => (
              <TagChip key={tag.id} name={tag.name} color={tag.color} />
            ))}
            {limitPct !== null && (
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px]">
                <span className="bg-secondary h-1.5 w-16 overflow-hidden rounded-full">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      limitPct >= 100 ? "bg-amber-500" : "bg-primary",
                    )}
                    style={{ width: `${limitPct}%` }}
                  />
                </span>
                {link.clickCount}/{link.maxClicks}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="hidden w-28 shrink-0 justify-center lg:flex">
        <StatusBadge status={link.status} />
      </div>

      <Link
        href={`/dashboard/links/${link.id}`}
        title={link.lastClickedAt ? `Last click ${timeAgo(link.lastClickedAt)}` : "No clicks yet"}
        className="hover:bg-secondary flex w-20 shrink-0 flex-col items-center rounded-xl py-1 transition-colors"
      >
        <span className="text-foreground flex items-center gap-1 text-base font-bold tabular-nums">
          <MousePointerClick className="text-muted-foreground size-3.5" />
          {compactNumber(link.clickCount)}
        </span>
        <span className="text-muted-foreground text-[11px]">clicks</span>
      </Link>

      <span className="text-muted-foreground hidden w-24 shrink-0 text-center text-xs xl:block">
        {formatDate(link.createdAt)}
      </span>

      <div className="shrink-0">
        <LinkActionsMenu link={link} />
      </div>
    </div>
  );
}

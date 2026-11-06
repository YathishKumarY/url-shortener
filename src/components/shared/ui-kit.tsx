"use client";

import { useState } from "react";
import {
  Ban,
  CalendarClock,
  CircleCheck,
  CircleSlash,
  Globe,
  Hourglass,
  Lock,
  PauseCircle,
  type LucideIcon,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { tagClasses } from "@/lib/tag-colors";
import { cn, faviconUrl } from "@/lib/utils";
import type { LinkStatus } from "@/types";

/* ------------------------------------------------------------- buttons */

const pillBase =
  "inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[48px] px-5 text-sm font-semibold whitespace-nowrap outline-none transition-[background-color,color,transform,opacity,box-shadow] duration-150 active:scale-[0.97] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

/** Class names for the app's pill buttons (the Linkly design language). */
export const pill = {
  primary: cn(pillBase, "bg-primary shadow-blue hover:bg-primary/90 text-white"),
  secondary: cn(
    pillBase,
    "border-border bg-secondary text-card-foreground shadow-soft hover:bg-secondary/70 hover:text-foreground border",
  ),
  danger: cn(pillBase, "bg-destructive hover:bg-destructive/85 text-white"),
  ghost: cn(pillBase, "text-card-foreground hover:bg-secondary hover:text-foreground"),
  small: "h-8 px-3.5 text-[13px]",
  icon: "border-border bg-secondary text-card-foreground hover:text-foreground hover:bg-secondary/70 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-[background-color,color,transform] duration-150 active:scale-[0.94] focus-visible:ring-3 focus-visible:ring-ring/50 outline-none disabled:opacity-50 [&_svg]:size-4",
};

/* -------------------------------------------------------------- panels */

export function Panel({ className, children, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "border-border/60 bg-card/70 shadow-soft rounded-2xl border p-5 backdrop-blur-sm",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="bg-primary/10 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
            <Icon className="size-4" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-foreground text-[15px] font-semibold">{title}</h2>
          {description && (
            <p className="text-muted-foreground mt-0.5 text-[13px] leading-snug">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border/70 flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-14 text-center",
        className,
      )}
    >
      <div className="bg-primary/10 text-primary mb-4 flex size-12 items-center justify-center rounded-2xl">
        <Icon className="size-6" />
      </div>
      <p className="text-foreground text-base font-semibold">{title}</p>
      {description && (
        <p className="text-muted-foreground mt-1 max-w-sm text-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------- badges */

const STATUS: Record<LinkStatus, { label: string; icon: LucideIcon; className: string }> = {
  active: {
    label: "Active",
    icon: CircleCheck,
    className: "bg-green-500/12 text-green-700 ring-green-500/25 dark:text-green-400",
  },
  scheduled: {
    label: "Scheduled",
    icon: CalendarClock,
    className: "bg-blue-500/12 text-blue-700 ring-blue-500/25 dark:text-blue-300",
  },
  expired: {
    label: "Expired",
    icon: Hourglass,
    className: "bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  },
  limited: {
    label: "Limit reached",
    icon: CircleSlash,
    className: "bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  },
  disabled: {
    label: "Paused",
    icon: PauseCircle,
    className: "bg-zinc-500/12 text-zinc-700 ring-zinc-500/25 dark:text-zinc-300",
  },
  banned: {
    label: "Blocked",
    icon: Ban,
    className: "bg-red-500/12 text-red-700 ring-red-500/25 dark:text-red-300",
  },
};

export function StatusBadge({ status, className }: { status: LinkStatus; className?: string }) {
  const { label, icon: Icon, className: tone } = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium ring-1 ring-inset",
        tone,
        className,
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}

export function TagChip({
  name,
  color,
  onRemove,
  className,
}: {
  name: string;
  color: string;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-[160px] items-center gap-1 rounded-full px-2 text-xs font-medium ring-1 ring-inset",
        tagClasses(color),
        className,
      )}
    >
      <span className="truncate">{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${name}`}
          className="-mr-0.5 rounded-full px-0.5 opacity-70 hover:opacity-100"
        >
          ×
        </button>
      )}
    </span>
  );
}

export function FeatureChip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span
      title={label}
      className="text-muted-foreground bg-secondary inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium"
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}

export function LockBadge() {
  return <FeatureChip icon={Lock} label="Password" />;
}

/* ------------------------------------------------------------- favicon */

export function Favicon({
  url,
  size = 32,
  className,
}: {
  url: string;
  size?: 16 | 32;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = faviconUrl(url, size);
  if (!src || failed) {
    return (
      <span
        className={cn(
          "bg-secondary text-muted-foreground flex shrink-0 items-center justify-center rounded-lg",
          className,
        )}
      >
        <Globe className="size-1/2" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn(
        "shrink-0 rounded-lg bg-white/90 object-contain p-0.5 outline outline-1 -outline-offset-1 outline-black/5",
        className,
      )}
    />
  );
}

/* ---------------------------------------------------------- segmented */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "default",
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: React.ReactNode; count?: number }>;
  className?: string;
  size?: "sm" | "default";
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "bg-secondary border-border/70 inline-flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-full border p-1",
        "scrollbar-none",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-200",
              size === "sm" ? "h-7 px-3 text-xs" : "h-8 px-3.5 text-[13px]",
              active
                ? "bg-primary text-white shadow-[0_2px_10px_rgba(20,78,227,0.35)]"
                : "text-card-foreground/80 hover:text-foreground",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn("tabular-nums", active ? "text-white/80" : "text-muted-foreground")}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- forms */

export const inputClass =
  "border-border bg-input/60 text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-primary/25 h-10 w-full min-w-0 rounded-xl border px-3 text-sm transition-[border-color,box-shadow] outline-none focus-visible:ring-3 disabled:opacity-60 aria-invalid:border-destructive";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
  trailing,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-card-foreground text-[13px] font-medium">
          {label}
        </label>
        {trailing}
      </div>
      {children}
      {error ? (
        <p className="text-destructive mt-1.5 text-xs">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground mt-1.5 text-xs leading-snug">{hint}</p>
      ) : null}
    </div>
  );
}

export function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
  icon: Icon,
  disabled,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  icon?: LucideIcon;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "hover:bg-secondary/50 flex cursor-pointer items-start justify-between gap-4 rounded-xl p-3 transition-colors",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon && <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />}
        <div className="min-w-0">
          <p className="text-foreground text-sm font-medium">{title}</p>
          {description && (
            <p className="text-muted-foreground mt-0.5 text-xs leading-snug">{description}</p>
          )}
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="mt-0.5"
      />
    </label>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="border-border bg-secondary text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-mono text-[10px]">
      {children}
    </kbd>
  );
}

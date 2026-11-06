"use client";

import { Check } from "lucide-react";
import { BIO_THEME_LIST, type BioTheme, type BioThemeId } from "@/components/bio/themes";
import { cn } from "@/lib/utils";

/** A miniature of the page in the theme: avatar, name line and two buttons. */
function ThemeSwatch({ theme }: { theme: BioTheme }) {
  const t = theme.classes;
  return (
    <div
      aria-hidden
      className="relative h-[104px] overflow-hidden rounded-[12px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
      style={{ background: theme.swatch }}
    >
      <div className="absolute inset-x-0 top-3.5 flex flex-col items-center gap-1.5">
        <span className={cn("size-6 rounded-full ring-2 ring-white/25", t.avatarFallback)} />
        <span className={cn("h-1.5 w-12 rounded-full", t.miniLine)} />
      </div>
      <div className="absolute inset-x-3.5 bottom-3 flex flex-col gap-1.5">
        <span className={cn("h-4 rounded-[6px]", t.miniButton)} />
        <span className={cn("h-4 rounded-[6px]", t.miniButton)} />
      </div>
    </div>
  );
}

/**
 * Theme choice as a native radio group: Tab enters at the selected theme and
 * the arrow keys move between themes, with no extra keyboard code.
 */
export function ThemePicker({
  value,
  onChange,
  name = "bio-theme",
}: {
  value: BioThemeId;
  onChange: (theme: BioThemeId) => void;
  name?: string;
}) {
  return (
    <fieldset>
      <legend className="sr-only">Page theme</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {BIO_THEME_LIST.map((theme) => {
          const checked = theme.id === value;
          return (
            <label
              key={theme.id}
              title={theme.tagline}
              className={cn(
                "group relative cursor-pointer rounded-[18px] p-1.5 transition-[box-shadow,background-color,translate] duration-200 ease-out motion-safe:hover:-translate-y-0.5",
                "has-[input:focus-visible]:ring-ring/50 has-[input:focus-visible]:ring-3",
                checked
                  ? "bg-primary/[0.06] shadow-[0_0_0_2px_var(--primary),0_8px_24px_-12px_rgba(20,78,227,0.55)]"
                  : "bg-secondary/40 shadow-[0_0_0_1px_var(--border)] hover:shadow-[0_0_0_1px_var(--muted-foreground)]",
              )}
            >
              <input
                type="radio"
                name={name}
                value={theme.id}
                checked={checked}
                onChange={() => onChange(theme.id)}
                className="sr-only"
              />
              <ThemeSwatch theme={theme} />
              <span className="flex items-center justify-between gap-2 px-1.5 pt-2.5 pb-1">
                <span className="min-w-0">
                  <span className="text-foreground block text-sm font-semibold">
                    {theme.name}
                    <span className="sr-only">, {theme.tagline}</span>
                  </span>
                  <span
                    aria-hidden
                    className="text-muted-foreground block text-[11px] leading-snug"
                  >
                    {theme.scheme === "light" ? "Light" : "Dark"}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "bg-primary flex size-5 shrink-0 items-center justify-center rounded-full text-white transition-[opacity,scale] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
                    checked ? "scale-100 opacity-100" : "scale-50 opacity-0",
                  )}
                >
                  <Check className="size-3" strokeWidth={3} />
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

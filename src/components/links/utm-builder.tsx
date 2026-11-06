"use client";

import { useState } from "react";
import { ChevronDown, Megaphone } from "lucide-react";
import { inputClass } from "@/components/shared/ui-kit";
import { cn } from "@/lib/utils";

const UTM_FIELDS = [
  { key: "utm_source", label: "Source", placeholder: "newsletter, twitter, google" },
  { key: "utm_medium", label: "Medium", placeholder: "email, social, cpc" },
  { key: "utm_campaign", label: "Campaign", placeholder: "spring_sale" },
  { key: "utm_term", label: "Term", placeholder: "running+shoes" },
  { key: "utm_content", label: "Content", placeholder: "logolink, textlink" },
] as const;

const PRESETS: Array<{ label: string; values: Record<string, string> }> = [
  { label: "Newsletter", values: { utm_source: "newsletter", utm_medium: "email" } },
  { label: "X / Twitter", values: { utm_source: "twitter", utm_medium: "social" } },
  { label: "LinkedIn", values: { utm_source: "linkedin", utm_medium: "social" } },
  { label: "Google Ads", values: { utm_source: "google", utm_medium: "cpc" } },
];

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * Edits UTM parameters directly on the destination URL, so what you see in
 * the URL field is exactly where visitors land.
 */
export function UtmBuilder({ url, onChange }: { url: string; onChange: (url: string) => void }) {
  const parsed = parse(url);
  const activeCount = parsed ? UTM_FIELDS.filter((f) => parsed.searchParams.get(f.key)).length : 0;
  const [open, setOpen] = useState(activeCount > 0);

  function set(values: Record<string, string>) {
    const next = parse(url);
    if (!next) return;
    for (const [key, value] of Object.entries(values)) {
      if (value) next.searchParams.set(key, value);
      else next.searchParams.delete(key);
    }
    onChange(next.toString());
  }

  return (
    <div className="border-border/70 rounded-xl border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="hover:bg-secondary/40 flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors"
      >
        <Megaphone className="text-muted-foreground size-4" />
        <span className="text-foreground flex-1 text-sm font-medium">UTM builder</span>
        {activeCount > 0 && (
          <span className="bg-primary/12 text-primary rounded-full px-2 py-0.5 text-[11px] font-semibold">
            {activeCount} set
          </span>
        )}
        <ChevronDown
          className={cn("text-muted-foreground size-4 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="space-y-3 px-3 pb-3">
          {!parsed && (
            <p className="text-muted-foreground text-xs">
              Enter a valid destination URL to add UTM parameters.
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={!parsed}
                onClick={() => set(preset.values)}
                className="bg-secondary text-card-foreground hover:text-foreground cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {UTM_FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="text-muted-foreground mb-1 block text-xs">{field.label}</span>
                <input
                  disabled={!parsed}
                  value={parsed?.searchParams.get(field.key) ?? ""}
                  onChange={(e) => set({ [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  className={cn(inputClass, "h-9 text-[13px]")}
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

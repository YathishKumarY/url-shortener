"use client";

import { useSyncExternalStore } from "react";
import { CopyIconButton } from "@/components/public/copy-button";
import { mono } from "@/components/public/styles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface CodeSample {
  /** Tab label, e.g. "curl", "JavaScript", "Python". Shared across blocks. */
  label: string;
  code: string;
}

/*
 * One language choice for the whole page: picking Python in one block
 * switches every block. Kept in memory only, so the server render and the
 * first client render agree and nothing shifts on load.
 */
const DEFAULT_LANGUAGE = "curl";
let preferred = DEFAULT_LANGUAGE;
const listeners = new Set<() => void>();

const languageStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => preferred,
  getServer: () => DEFAULT_LANGUAGE,
  set(value: string) {
    preferred = value;
    listeners.forEach((listener) => listener());
  },
};

/** Tabbed code sample (curl / JavaScript / Python) with a copy button. */
export function CodeTabs({ samples, className }: { samples: CodeSample[]; className?: string }) {
  const language = useSyncExternalStore(
    languageStore.subscribe,
    languageStore.get,
    languageStore.getServer,
  );
  const active = samples.find((sample) => sample.label === language) ?? samples[0];
  if (!active) return null;

  return (
    <Tabs
      value={active.label}
      onValueChange={(value) => languageStore.set(String(value))}
      className={cn(
        "border-border/60 bg-card/70 shadow-soft gap-0 overflow-hidden rounded-2xl border",
        className,
      )}
    >
      <div className="border-border/60 bg-secondary/50 flex h-11 items-center justify-between gap-2 border-b pr-1.5 pl-2">
        {/* No overflow clipping here: the active underline hangs below the list. */}
        <TabsList variant="line" aria-label="Language" className="gap-0.5 p-0">
          {samples.map((sample) => (
            <TabsTrigger
              key={sample.label}
              value={sample.label}
              className="group/tab text-muted-foreground hover:text-foreground data-active:text-foreground h-8 flex-none rounded-lg px-2.5 text-xs font-medium after:hidden data-active:bg-transparent data-active:shadow-none dark:data-active:border-transparent dark:data-active:bg-transparent"
            >
              {sample.label}
              {/* Underline sits on the header's bottom border. */}
              <span
                aria-hidden
                className="bg-primary absolute inset-x-2.5 -bottom-1.5 h-0.5 rounded-full opacity-0 transition-opacity group-data-active/tab:opacity-100"
              />
            </TabsTrigger>
          ))}
        </TabsList>
        <CopyIconButton text={active.code} label={`Copy ${active.label} example`} size="sm" />
      </div>
      {samples.map((sample) => (
        <TabsContent key={sample.label} value={sample.label} tabIndex={-1}>
          <pre
            tabIndex={0}
            className={cn(
              mono,
              "text-foreground/90 focus-visible:ring-ring/50 overflow-x-auto px-4 py-3.5 text-[13px] leading-6 outline-none focus-visible:ring-3 focus-visible:ring-inset",
            )}
          >
            <code>{sample.code}</code>
          </pre>
        </TabsContent>
      ))}
    </Tabs>
  );
}

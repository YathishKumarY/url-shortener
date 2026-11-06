"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ListTree } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TocEntry {
  id: string;
  label: string;
  children?: TocEntry[];
}

function flatten(entries: TocEntry[]): TocEntry[] {
  return entries.flatMap((entry) => [entry, ...(entry.children ?? [])]);
}

/** Id of the last section whose top has scrolled past the reading line. */
function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join(" ");

  useEffect(() => {
    const list = key.split(" ").filter(Boolean);
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = list[0] ?? null;
      for (const id of list) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= 120) current = id;
      }
      const scroller = document.documentElement;
      if (window.innerHeight + window.scrollY >= scroller.scrollHeight - 2) {
        current = list[list.length - 1] ?? current;
      }
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [key]);

  return active;
}

const linkBase =
  "focus-visible:ring-ring/50 block rounded-r-md py-1.5 text-[13px] leading-snug outline-none transition-colors focus-visible:ring-3";

/** Sticky "On this page" sidebar for desktop, with the current section highlighted. */
export function DocsToc({ entries }: { entries: TocEntry[] }) {
  const active = useActiveSection(flatten(entries).map((entry) => entry.id));

  return (
    <nav aria-label="On this page">
      <p className="text-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
        On this page
      </p>
      <ul className="border-border/60 space-y-0.5 border-l">
        {entries.map((entry) => {
          const containsActive = entry.children?.some((child) => child.id === active) ?? false;
          return (
            <li key={entry.id}>
              <a
                href={`#${entry.id}`}
                aria-current={active === entry.id ? "location" : undefined}
                className={cn(
                  linkBase,
                  "-ml-px border-l-2 pl-4",
                  active === entry.id
                    ? "border-primary text-foreground font-medium"
                    : containsActive
                      ? "text-foreground border-transparent"
                      : "text-muted-foreground hover:text-foreground hover:border-border border-transparent",
                )}
              >
                {entry.label}
              </a>
              {entry.children && (
                <ul className="mt-0.5 space-y-0.5">
                  {entry.children.map((child) => (
                    <li key={child.id}>
                      <a
                        href={`#${child.id}`}
                        aria-current={active === child.id ? "location" : undefined}
                        className={cn(
                          linkBase,
                          "-ml-px border-l-2 pl-7",
                          active === child.id
                            ? "border-primary text-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:border-border border-transparent",
                        )}
                      >
                        {child.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Collapsible table of contents for phones and tablets. Closes after a jump. */
export function DocsTocMobile({ entries }: { entries: TocEntry[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => ref.current?.removeAttribute("open");

  return (
    <details
      ref={ref}
      className="group border-border/60 bg-card/70 shadow-soft rounded-2xl border backdrop-blur-sm"
    >
      <summary className="text-foreground focus-visible:ring-ring/50 flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus-visible:ring-3 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <ListTree className="text-primary size-4" aria-hidden />
          On this page
        </span>
        <ChevronDown
          className="text-muted-foreground size-4 transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <nav aria-label="On this page" className="border-border/60 border-t px-2 py-2">
        <ul className="space-y-0.5">
          {entries.map((entry) => (
            <li key={entry.id}>
              <a
                href={`#${entry.id}`}
                onClick={close}
                className="text-card-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-ring/50 block rounded-lg px-3 py-2 text-sm outline-none focus-visible:ring-3"
              >
                {entry.label}
              </a>
              {entry.children && (
                <ul className="space-y-0.5">
                  {entry.children.map((child) => (
                    <li key={child.id}>
                      <a
                        href={`#${child.id}`}
                        onClick={close}
                        className="text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-ring/50 block rounded-lg py-1.5 pr-3 pl-7 text-[13px] outline-none focus-visible:ring-3"
                      >
                        {child.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}

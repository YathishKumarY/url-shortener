"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Lock } from "lucide-react";
import { formatLocal } from "@/components/public/local-time";
import { pill } from "@/components/shared/ui-kit";
import { cn } from "@/lib/utils";

const UNITS = [
  { label: "Days", seconds: 86_400 },
  { label: "Hours", seconds: 3_600 },
  { label: "Minutes", seconds: 60 },
  { label: "Seconds", seconds: 1 },
] as const;

/**
 * The current time, refreshed on each wall-clock second until `target` has
 * passed. Null until mounted, so the server and the first client render match.
 */
function useClock(target: number): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      // Align to the next second so the display never skips or repeats one.
      if (current < target) timer = window.setTimeout(tick, 1000 - (current % 1000) + 10);
    };
    timer = window.setTimeout(tick, 0);
    return () => window.clearTimeout(timer);
  }, [target]);

  return now;
}

function split(ms: number): number[] {
  let rest = Math.ceil(ms / 1000);
  return UNITS.map(({ seconds }) => {
    const value = Math.floor(rest / seconds);
    rest -= value * seconds;
    return value;
  });
}

/** Live countdown to a scheduled link's start, with an "Open link" pill once it is live. */
export function Countdown({ at, href }: { at: string; href: string | null }) {
  const target = new Date(at).getTime();
  const now = useClock(target);
  const remaining = now === null ? null : Math.max(0, target - now);
  const parts = remaining === null ? null : split(remaining);
  const live = remaining === 0;

  return (
    <div className="w-full">
      <div className="grid grid-cols-4 gap-2 sm:gap-3" aria-hidden>
        {UNITS.map((unit, index) => (
          <div
            key={unit.label}
            className="border-border/60 bg-card/70 shadow-soft rounded-2xl border px-1 py-3 backdrop-blur-sm"
          >
            <span className="text-foreground block text-2xl leading-none font-bold tabular-nums sm:text-3xl">
              {parts ? String(parts[index]).padStart(2, "0") : "--"}
            </span>
            <span className="text-muted-foreground mt-2 block text-[10px] font-medium tracking-wider uppercase sm:text-[11px]">
              {unit.label}
            </span>
          </div>
        ))}
      </div>

      <p className="text-muted-foreground mt-4 min-h-5 text-sm">
        {now === null ? (
          "\u00a0"
        ) : (
          <>
            {live ? "Opened " : "Opens "}
            <time
              dateTime={new Date(target).toISOString()}
              className="text-card-foreground font-medium"
            >
              {formatLocal(new Date(target))}
            </time>
          </>
        )}
      </p>

      {href && (
        <div aria-live="polite" className="mt-6 flex justify-center">
          {live ? (
            <a href={href} className={cn(pill.primary, "w-full sm:w-auto")}>
              Open link
              <ArrowUpRight />
            </a>
          ) : (
            <span
              aria-disabled="true"
              className={cn(
                pill.secondary,
                "pointer-events-none w-full cursor-default opacity-60 sm:w-auto",
              )}
            >
              <Lock />
              Not open yet
            </span>
          )}
        </div>
      )}
    </div>
  );
}

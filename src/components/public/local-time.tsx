"use client";

import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/**
 * False on the server and during hydration, true afterwards. Lets text depend
 * on the visitor's locale or timezone without a hydration mismatch, and
 * without a setState-in-effect round trip.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

const DATE_TIME: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
};

const DATE_ONLY: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };

/** Format in the visitor's locale and timezone, or in a fixed zone (as en-US) when given. */
export function formatLocal(date: Date, withTime = true, timeZone?: string): string {
  return new Intl.DateTimeFormat(timeZone ? "en-US" : undefined, {
    ...(withTime ? DATE_TIME : DATE_ONLY),
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

/**
 * A timestamp in the visitor's own locale and timezone. The server knows
 * neither, so it renders UTC and the client swaps in local time once hydrated.
 */
export function LocalTime({
  value,
  withTime = true,
  className,
}: {
  value: string;
  withTime?: boolean;
  className?: string;
}) {
  const hydrated = useHydrated();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return (
    <time dateTime={date.toISOString()} className={className}>
      {hydrated ? formatLocal(date, withTime) : formatLocal(date, withTime, "UTC")}
    </time>
  );
}

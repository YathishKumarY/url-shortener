"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  Link2,
  Monitor,
  MousePointerClick,
  Pause,
  Play,
  QrCode,
  Radio,
  Share2,
  Smartphone,
  Tablet,
} from "lucide-react";
import { EmptyState, Panel, PageHeader, pill } from "@/components/shared/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/api-client";
import { countryFlag, countryName } from "@/lib/countries";
import { formatNumber, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ClickEvent } from "@/types";

const DEVICE_ICON = { mobile: Smartphone, tablet: Tablet, bot: Bot } as const;
const SOURCE = {
  qr: { icon: QrCode, label: "QR scan" },
  bio: { icon: Share2, label: "Bio page" },
  link: { icon: Link2, label: "Link" },
} as const;
const MAX_EVENTS = 200;
const MINUTES = 30;

type Connection = "connecting" | "live" | "paused" | "offline";
type StreamEvent = ClickEvent & { fresh?: boolean };

function useNow(interval = 5000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** Whether this tab is the one the person is looking at. */
function useDocumentVisible() {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => true,
  );
}

/** Clicks per minute over the last half hour, from the events we hold. */
function PerMinute({ events, now }: { events: StreamEvent[]; now: number }) {
  const buckets = useMemo(() => {
    const counts = Array.from({ length: MINUTES }, () => 0);
    for (const e of events) {
      const age = Math.floor((now - new Date(e.timestamp).getTime()) / 60_000);
      if (age >= 0 && age < MINUTES) counts[MINUTES - 1 - age]++;
    }
    return counts;
  }, [events, now]);
  const max = Math.max(1, ...buckets);
  const lastFive = buckets.slice(-5).reduce((a, b) => a + b, 0);

  return (
    <Panel className="p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-muted-foreground text-[13px] font-medium">Clicks per minute</p>
        <p className="text-muted-foreground text-xs">
          <span className="text-foreground font-semibold tabular-nums">{lastFive}</span> in the last
          5 min
        </p>
      </div>
      <div className="flex h-16 items-end gap-[3px]">
        {buckets.map((count, i) => (
          <div
            key={i}
            title={`${MINUTES - 1 - i} min ago: ${count}`}
            className={cn(
              "flex-1 rounded-t-sm transition-[height] duration-500",
              count ? "bg-primary" : "bg-secondary",
            )}
            style={{
              height: `${Math.max(6, (count / max) * 100)}%`,
              opacity: count ? 0.45 + (i / MINUTES) * 0.55 : 1,
            }}
          />
        ))}
      </div>
      <div className="text-muted-foreground mt-1.5 flex justify-between text-[10px]">
        <span>30 min ago</span>
        <span>now</span>
      </div>
    </Panel>
  );
}

export default function ClickStreamPage() {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [includeBots, setIncludeBots] = useState(false);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [sessionCount, setSessionCount] = useState(0);
  const now = useNow();

  // Backfill with the latest clicks, then stream new ones.
  const { data: initial, isLoading } = useQuery<ClickEvent[]>({
    queryKey: ["click-stream", includeBots],
    queryFn: () => apiFetch(`/api/clicks/stream?includeBots=${includeBots}`),
    staleTime: 0,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initial) setEvents(initial);
  }, [initial]);

  // Newest click this page has shown, so a reopened stream can catch up.
  const lastSeen = useRef<string | null>(null);
  useEffect(() => {
    const newest = events[0]?.timestamp;
    if (newest && (!lastSeen.current || newest > lastSeen.current)) lastSeen.current = newest;
  }, [events]);

  // Every open stream polls the database, so a tab in the background lets go
  // of it and catches up on what it missed when it is shown again.
  const visible = useDocumentVisible();

  useEffect(() => {
    if (paused) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConnection("paused");
      return;
    }
    if (!visible) return;
    setConnection("connecting");
    const params = new URLSearchParams({ includeBots: String(includeBots) });
    if (lastSeen.current) params.set("since", lastSeen.current);
    const source = new EventSource(`/api/clicks/stream?${params}`);
    source.onopen = () => setConnection("live");
    source.onerror = () =>
      setConnection(source.readyState === EventSource.CLOSED ? "offline" : "connecting");
    source.addEventListener("click", (message) => {
      const click = JSON.parse((message as MessageEvent).data) as ClickEvent;
      setSessionCount((n) => n + 1);
      setEvents((prev) =>
        prev.some((e) => e.id === click.id)
          ? prev
          : [{ ...click, fresh: true }, ...prev].slice(0, MAX_EVENTS),
      );
    });
    return () => source.close();
  }, [paused, includeBots, visible]);

  const status = {
    connecting: { label: "Connecting...", dot: "bg-amber-400" },
    live: { label: "Live", dot: "bg-green-500" },
    paused: { label: "Paused", dot: "bg-zinc-400" },
    offline: { label: "Reconnecting...", dot: "bg-red-500" },
  }[connection];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Live clicks
            <span className="border-border bg-secondary inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold">
              <span className="relative flex size-2">
                {connection === "live" && (
                  <span
                    className={cn(
                      "absolute inline-flex size-full animate-ping rounded-full opacity-75",
                      status.dot,
                    )}
                  />
                )}
                <span className={cn("relative inline-flex size-2 rounded-full", status.dot)} />
              </span>
              {status.label}
            </span>
          </span>
        }
        description="Every visit to your links as it happens, streamed in real time."
        actions={
          <>
            <label className="text-card-foreground flex cursor-pointer items-center gap-2 text-[13px]">
              <Bot className="text-muted-foreground size-4" /> Bots
              <Switch checked={includeBots} onCheckedChange={setIncludeBots} size="sm" />
            </label>
            <button
              type="button"
              className={cn(pill.secondary, pill.small)}
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? <Play /> : <Pause />} {paused ? "Resume" : "Pause"}
            </button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-[1fr_200px]">
        <PerMinute events={events} now={now} />
        <Panel className="flex flex-col justify-center p-4">
          <p className="text-muted-foreground text-[13px] font-medium">
            Since you opened this page
          </p>
          <p className="text-foreground mt-1 text-3xl font-bold tabular-nums">
            {formatNumber(sessionCount)}
          </p>
          <p className="text-muted-foreground text-xs">new clicks</p>
        </Panel>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="Waiting for the first click"
          description="Share one of your links and keep this page open - visits will pop in here instantly."
        />
      ) : (
        <ul className="space-y-2">
          {events.map((click) => {
            const DeviceIcon = DEVICE_ICON[click.device as keyof typeof DEVICE_ICON] ?? Monitor;
            const source = SOURCE[(click.source as keyof typeof SOURCE) ?? "link"] ?? SOURCE.link;
            const fresh = click.fresh;
            return (
              <li
                key={click.id}
                className={cn(
                  "border-border/60 bg-card/70 shadow-soft flex items-center gap-4 rounded-2xl border p-3.5 backdrop-blur-sm",
                  fresh && "animate-in fade-in slide-in-from-top-2 duration-500",
                  click.isBot && "opacity-60",
                )}
              >
                <div className="bg-primary/10 text-primary relative flex size-10 shrink-0 items-center justify-center rounded-xl text-lg">
                  {click.country ? (
                    countryFlag(click.country)
                  ) : (
                    <MousePointerClick className="size-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <Link
                      href={`/dashboard/links/${click.link.id}`}
                      className="text-primary truncate text-sm font-semibold hover:underline"
                    >
                      {click.link.domain ? `${click.link.domain}/` : "/"}
                      {click.link.shortCode}
                    </Link>
                    <span className="text-muted-foreground truncate text-xs">
                      {click.link.title ?? click.link.originalUrl.replace(/^https?:\/\//, "")}
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="flex items-center gap-1">
                      <source.icon className="size-3" /> {source.label}
                    </span>
                    <span className="flex items-center gap-1">
                      <DeviceIcon className="size-3" />
                      {click.isBot
                        ? "Bot"
                        : [click.browser, click.os].filter(Boolean).join(" on ") ||
                          "Unknown device"}
                    </span>
                    <span>
                      {click.city ? `${click.city}, ` : ""}
                      {click.country ? countryName(click.country) : "Unknown location"}
                    </span>
                    {click.referrerHost && (
                      <span className="truncate">via {click.referrerHost}</span>
                    )}
                  </div>
                </div>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {timeAgo(click.timestamp, now)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

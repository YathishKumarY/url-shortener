"use client";

import { useQuery } from "@tanstack/react-query";
import { MousePointerClick, Globe, Monitor, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ClickEvent {
  id: string;
  timestamp: string;
  referrer: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  country: string | null;
  city: string | null;
  link: {
    shortCode: string;
    originalUrl: string;
  };
}

export default function ClickStreamPage() {
  const { data, isLoading } = useQuery<ClickEvent[]>({
    queryKey: ["click-stream"],
    queryFn: async () => {
      const res = await fetch("/api/clicks/stream");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 10000,
  });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-foreground mb-6 text-xl font-bold">Click Stream</h1>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : !data?.length ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center py-16">
          <MousePointerClick className="mb-4 h-12 w-12" />
          <p className="text-lg font-medium">No clicks yet</p>
          <p className="text-sm">Share your short links to see real-time clicks here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((click) => (
            <div
              key={click.id}
              className="border-border bg-card flex items-center gap-4 rounded-lg border p-4"
            >
              <div className="bg-primary/10 rounded-full p-2">
                <MousePointerClick className="text-primary h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-primary text-sm font-medium">/{click.link.shortCode}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    → {click.link.originalUrl}
                  </span>
                </div>
                <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                  {click.browser && (
                    <span className="flex items-center gap-1">
                      <Monitor className="h-3 w-3" />
                      {click.browser} · {click.os}
                    </span>
                  )}
                  {click.country && (
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {click.city ? `${click.city}, ` : ""}
                      {click.country}
                    </span>
                  )}
                  {click.referrer && (
                    <span className="max-w-[200px] truncate">from {click.referrer}</span>
                  )}
                </div>
              </div>
              <div className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
                <Clock className="h-3 w-3" />
                {formatTimeAgo(click.timestamp)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

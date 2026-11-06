"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  Download,
  Link2,
  Monitor,
  MousePointerClick,
  QrCode,
  Share2,
  Smartphone,
  Tablet,
} from "lucide-react";
import { EmptyState, Panel, PanelHeader, pill } from "@/components/shared/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, downloadFrom } from "@/lib/api-client";
import { countryFlag, countryName } from "@/lib/countries";
import { formatDateTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ClickRow {
  timestamp: string;
  source: string | null;
  destination: string | null;
  referrerHost: string | null;
  country: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  language: string | null;
  isBot: boolean;
}

const DEVICE_ICON = { mobile: Smartphone, tablet: Tablet, bot: Bot } as const;
const SOURCE_ICON = { qr: QrCode, bio: Share2 } as const;

/** Latest 100 visits, plus full CSV/JSON export (spoo.me-style). */
export function ActivityTable({
  linkId,
  showDestination,
}: {
  linkId: string;
  showDestination: boolean;
}) {
  const { data, isLoading } = useQuery<{ clicks: ClickRow[] }>({
    queryKey: ["link-clicks", linkId],
    queryFn: () => apiFetch(`/api/links/${linkId}/clicks`),
    refetchInterval: 15_000,
  });

  return (
    <Panel>
      <PanelHeader
        icon={MousePointerClick}
        title="Recent activity"
        description="The latest 100 visits, including bots. Refreshes every 15 seconds."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(pill.secondary, pill.small)}
              onClick={() => downloadFrom(`/api/links/${linkId}/clicks?format=csv`)}
            >
              <Download /> CSV
            </button>
            <button
              type="button"
              className={cn(pill.secondary, pill.small)}
              onClick={() => downloadFrom(`/api/links/${linkId}/clicks?format=json`)}
            >
              <Download /> JSON
            </button>
          </div>
        }
      />
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-11 rounded-xl" />
          ))}
        </div>
      ) : !data?.clicks.length ? (
        <EmptyState
          icon={MousePointerClick}
          title="No visits yet"
          description="Share your link - visits will appear here in real time."
        />
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="text-muted-foreground border-border/60 border-b text-xs">
                <th className="px-2 py-2 font-medium">When</th>
                <th className="px-2 py-2 font-medium">Location</th>
                <th className="px-2 py-2 font-medium">Device</th>
                <th className="px-2 py-2 font-medium">Referrer</th>
                {showDestination && <th className="px-2 py-2 font-medium">Destination</th>}
              </tr>
            </thead>
            <tbody className="divide-border/40 divide-y">
              {data.clicks.map((click, i) => {
                const DeviceIcon = DEVICE_ICON[click.device as keyof typeof DEVICE_ICON] ?? Monitor;
                const SourceIcon = SOURCE_ICON[click.source as keyof typeof SOURCE_ICON] ?? Link2;
                return (
                  <tr
                    key={`${click.timestamp}-${i}`}
                    className={cn("hover:bg-secondary/40", click.isBot && "opacity-60")}
                  >
                    <td
                      className="px-2 py-2.5 whitespace-nowrap"
                      title={formatDateTime(click.timestamp)}
                    >
                      <span className="flex items-center gap-2">
                        <SourceIcon className="text-muted-foreground size-3.5" />
                        {timeAgo(click.timestamp)}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <span>{countryFlag(click.country)}</span>
                        <span className="truncate">
                          {click.city ? `${click.city}, ` : ""}
                          {click.country ? countryName(click.country) : "Unknown"}
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <DeviceIcon className="text-muted-foreground size-3.5" />
                        <span className="truncate">
                          {click.isBot
                            ? "Bot"
                            : [click.browser, click.os].filter(Boolean).join(" on ") || "Unknown"}
                        </span>
                      </span>
                    </td>
                    <td className="text-muted-foreground max-w-[160px] truncate px-2 py-2.5">
                      {click.referrerHost ?? "Direct"}
                    </td>
                    {showDestination && (
                      <td
                        className="text-muted-foreground max-w-[220px] truncate px-2 py-2.5"
                        title={click.destination ?? ""}
                      >
                        {click.destination?.replace(/^https?:\/\//, "") ?? "-"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

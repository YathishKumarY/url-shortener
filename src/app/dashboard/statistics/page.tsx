"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, Bot, Plus } from "lucide-react";
import { PERIOD_OPTIONS, StatsSkeleton, StatsView } from "@/components/analytics/stats-view";
import { EmptyState, PageHeader, pill, Segmented } from "@/components/shared/ui-kit";
import { Switch } from "@/components/ui/switch";
import { useAccountStats } from "@/hooks/use-analytics";
import { cn } from "@/lib/utils";

export default function StatisticsPage() {
  const [period, setPeriod] = useState("30d");
  const [includeBots, setIncludeBots] = useState(false);
  const { data, isLoading, isFetching } = useAccountStats(period, includeBots);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Analytics"
        description="Performance across all of your links, in your local timezone."
        actions={
          <label className="text-card-foreground flex cursor-pointer items-center gap-2 text-[13px]">
            <Bot className="text-muted-foreground size-4" />
            Include bots
            <Switch checked={includeBots} onCheckedChange={setIncludeBots} size="sm" />
          </label>
        }
      />
      <div className="mb-5">
        <Segmented value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
      </div>

      {isLoading || !data ? (
        <StatsSkeleton />
      ) : data.totalLinks === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No links yet"
          description="Create a link and share it - clicks, locations, devices and referrers show up here as they happen."
          action={
            <Link href="/dashboard/links/new" className={pill.primary}>
              <Plus /> Create a link
            </Link>
          }
        />
      ) : (
        <div className={cn("transition-opacity", isFetching && "opacity-70")}>
          <StatsView stats={data} scope="account" />
        </div>
      )}
    </div>
  );
}

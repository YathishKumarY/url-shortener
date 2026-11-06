"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ChartColumn, Eye, Lock, RotateCw, TriangleAlert } from "lucide-react";
import { StatsSkeleton, StatsView, PERIOD_OPTIONS } from "@/components/analytics/stats-view";
import { CopyIconButton } from "@/components/public/copy-button";
import { Eyebrow } from "@/components/public/eyebrow";
import { EmptyState, Segmented, pill } from "@/components/shared/ui-kit";
import { ApiError, apiFetch } from "@/lib/api-client";
import { browserTimezone } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StatsData } from "@/types";

interface PublicStatsProps {
  code: string;
  /** Custom-domain hostname from `?domain=`, or "" for the default domain. */
  domain: string;
  shortUrl: string;
  displayUrl: string;
  /** The link's preview page (`/{code}+`) on the link's own host. */
  previewHref: string;
}

/** Analytics for a link whose owner turned on public stats. */
export function PublicStats({ code, domain, shortUrl, displayUrl, previewHref }: PublicStatsProps) {
  const [period, setPeriod] = useState("7d");

  const query = useQuery<StatsData>({
    queryKey: ["public-stats", domain, code, period],
    queryFn: () => {
      const params = new URLSearchParams({ period, tz: browserTimezone() });
      if (domain) params.set("domain", domain);
      return apiFetch(`/api/public/stats/${encodeURIComponent(code)}?${params}`);
    },
    placeholderData: keepPreviousData,
    // A 404 means the stats are private (or the link is gone): no point retrying.
    retry: (failures, error) =>
      !(error instanceof ApiError && error.status === 404) && failures < 2,
  });

  const isPrivate = query.error instanceof ApiError && query.error.status === 404;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 pt-2 sm:pt-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Eyebrow icon={ChartColumn}>Public stats</Eyebrow>
          <div className="mt-4 flex items-center gap-3">
            <h1 className="text-foreground min-w-0 text-2xl font-extrabold tracking-tight break-all sm:text-3xl">
              {displayUrl}
            </h1>
            <CopyIconButton
              text={shortUrl}
              label="Copy short link"
              toastMessage="Short link copied"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a href={previewHref} className={cn(pill.secondary, pill.small)}>
              <Eye />
              Preview link
            </a>
            <a href={shortUrl} rel="nofollow" className={cn(pill.ghost, pill.small)}>
              Open link
              <ArrowUpRight />
            </a>
          </div>
        </div>
        {!isPrivate && (
          <div role="group" aria-label="Time period" className="shrink-0">
            <Segmented value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
          </div>
        )}
      </header>

      {isPrivate ? (
        <EmptyState
          icon={Lock}
          title="Stats for this link are private"
          description="The owner has not made this link's analytics public. If it is your link, you can turn on public stats in its settings in the dashboard."
          action={
            <Link href="/dashboard" className={cn(pill.secondary, pill.small)}>
              Open dashboard
            </Link>
          }
          className="bg-card/40 py-16"
        />
      ) : query.data ? (
        <div
          aria-busy={query.isFetching}
          className={cn("transition-opacity duration-200", query.isPlaceholderData && "opacity-60")}
        >
          <StatsView stats={query.data} scope="public" />
        </div>
      ) : query.isError ? (
        <EmptyState
          icon={TriangleAlert}
          title="Could not load these stats"
          description={query.error.message || "Something went wrong. Please try again."}
          action={
            <button
              type="button"
              onClick={() => query.refetch()}
              className={cn(pill.secondary, pill.small)}
            >
              <RotateCw />
              Try again
            </button>
          }
          className="bg-card/40 py-16"
        />
      ) : (
        <div role="status" aria-label="Loading stats">
          <StatsSkeleton />
        </div>
      )}
    </div>
  );
}

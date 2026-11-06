"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { browserTimezone } from "@/lib/format";
import type { StatsData } from "@/types";

function query(period: string, includeBots: boolean) {
  return new URLSearchParams({
    period,
    tz: browserTimezone(),
    ...(includeBots ? { includeBots: "true" } : {}),
  });
}

/** Analytics for one link (owner only). */
export function useLinkStats(linkId: string, period = "7d", includeBots = false) {
  return useQuery<StatsData>({
    queryKey: ["stats", "link", linkId, period, includeBots],
    queryFn: () => apiFetch(`/api/links/${linkId}/stats?${query(period, includeBots)}`),
    enabled: !!linkId,
    placeholderData: keepPreviousData,
  });
}

/** Analytics across every link the user owns. */
export function useAccountStats(period = "7d", includeBots = false) {
  return useQuery<StatsData>({
    queryKey: ["stats", "account", period, includeBots],
    queryFn: () => apiFetch(`/api/stats?${query(period, includeBots)}`),
    placeholderData: keepPreviousData,
  });
}

/** @deprecated use useLinkStats */
export const useAnalytics = useLinkStats;

"use client";

import { useQuery } from "@tanstack/react-query";
import type { ClickAnalytics } from "@/types";

export function useAnalytics(linkId: string, period = "7d") {
  return useQuery<ClickAnalytics>({
    queryKey: ["analytics", linkId, period],
    queryFn: async () => {
      const res = await fetch(`/api/links/${linkId}/stats?period=${period}`);
      if (!res.ok) {
        let msg = "Failed to fetch analytics";
        try {
          const data = await res.json();
          if (typeof data.error === "string") msg = data.error;
        } catch {}
        throw new Error(msg);
      }
      return res.json();
    },
    enabled: !!linkId,
  });
}

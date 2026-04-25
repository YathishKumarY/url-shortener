"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MousePointerClick, Users, Link2 } from "lucide-react";
import { ClicksChart } from "@/components/analytics/clicks-chart";
import { DevicesChart } from "@/components/analytics/devices-chart";
import { LocationsTable } from "@/components/analytics/locations-table";
import { ReferrersChart } from "@/components/analytics/referrers-chart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const periods = [
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "All", value: "all" },
];

export default function StatisticsPage() {
  const [period, setPeriod] = useState("7d");

  const { data: links } = useQuery({
    queryKey: ["links", 1, ""],
    queryFn: async () => {
      const res = await fetch("/api/links?page=1&pageSize=100");
      if (!res.ok) throw new Error("Failed to fetch links");
      return res.json();
    },
  });

  const linkIds: string[] = links?.links?.map((l: { id: string }) => l.id) ?? [];

  const { data: stats, isLoading } = useQuery({
    queryKey: ["all-stats", period, linkIds],
    queryFn: async () => {
      if (linkIds.length === 0) return null;
      const results = await Promise.all(
        linkIds.map((id: string) =>
          fetch(`/api/links/${id}/stats?period=${period}`).then((r) => (r.ok ? r.json() : null)),
        ),
      );

      const merged = {
        clicksOverTime: new Map<string, number>(),
        topReferrers: new Map<string, number>(),
        devices: new Map<string, number>(),
        browsers: new Map<string, number>(),
        countries: new Map<string, number>(),
        totalClicks: 0,
        uniqueVisitors: 0,
      };

      for (const s of results) {
        if (!s) continue;
        merged.totalClicks += s.totalClicks;
        merged.uniqueVisitors += s.uniqueVisitors;
        for (const d of s.clicksOverTime) {
          merged.clicksOverTime.set(d.date, (merged.clicksOverTime.get(d.date) ?? 0) + d.clicks);
        }
        for (const r of s.topReferrers) {
          merged.topReferrers.set(
            r.referrer,
            (merged.topReferrers.get(r.referrer) ?? 0) + r.clicks,
          );
        }
        for (const d of s.devices) {
          merged.devices.set(d.device, (merged.devices.get(d.device) ?? 0) + d.clicks);
        }
        for (const b of s.browsers) {
          merged.browsers.set(b.browser, (merged.browsers.get(b.browser) ?? 0) + b.clicks);
        }
        for (const c of s.countries) {
          merged.countries.set(c.country, (merged.countries.get(c.country) ?? 0) + c.clicks);
        }
      }

      return {
        clicksOverTime: Array.from(merged.clicksOverTime.entries())
          .map(([date, clicks]) => ({ date, clicks }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        topReferrers: Array.from(merged.topReferrers.entries())
          .map(([referrer, clicks]) => ({ referrer, clicks }))
          .sort((a, b) => b.clicks - a.clicks)
          .slice(0, 10),
        devices: Array.from(merged.devices.entries())
          .map(([device, clicks]) => ({ device, clicks }))
          .sort((a, b) => b.clicks - a.clicks),
        countries: Array.from(merged.countries.entries())
          .map(([country, clicks]) => ({ country, clicks }))
          .sort((a, b) => b.clicks - a.clicks)
          .slice(0, 10),
        totalClicks: merged.totalClicks,
        uniqueVisitors: merged.uniqueVisitors,
        totalLinks: linkIds.length,
      };
    },
    enabled: linkIds.length > 0,
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-foreground text-xl font-bold">Statistics</h1>
        <div className="flex items-center gap-2">
          {periods.map((p) => (
            <Button
              key={p.value}
              variant={period === p.value ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(p.value)}
              className="rounded-lg"
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[300px] rounded-lg" />
          ))}
        </div>
      ) : stats ? (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="border-border bg-card flex items-center gap-4 rounded-lg border p-6">
              <div className="bg-primary/10 rounded-full p-3">
                <MousePointerClick className="text-primary h-6 w-6" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Clicks</p>
                <p className="text-foreground text-2xl font-bold">{stats.totalClicks}</p>
              </div>
            </div>
            <div className="border-border bg-card flex items-center gap-4 rounded-lg border p-6">
              <div className="rounded-full bg-green-500/10 p-3">
                <Users className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Unique Visitors</p>
                <p className="text-foreground text-2xl font-bold">{stats.uniqueVisitors}</p>
              </div>
            </div>
            <div className="border-border bg-card flex items-center gap-4 rounded-lg border p-6">
              <div className="bg-destructive/10 rounded-full p-3">
                <Link2 className="text-destructive h-6 w-6" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Links</p>
                <p className="text-foreground text-2xl font-bold">{stats.totalLinks}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ClicksChart data={stats.clicksOverTime} />
            <ReferrersChart data={stats.topReferrers} />
            <DevicesChart data={stats.devices} />
            <LocationsTable data={stats.countries} />
          </div>
        </>
      ) : (
        <div className="text-muted-foreground flex flex-col items-center justify-center py-16">
          <MousePointerClick className="mb-4 h-12 w-12" />
          <p className="text-lg font-medium">No statistics yet</p>
          <p className="text-sm">Create some links and share them to see analytics</p>
        </div>
      )}
    </div>
  );
}

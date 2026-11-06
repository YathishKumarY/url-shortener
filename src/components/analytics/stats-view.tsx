"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CalendarDays,
  Cpu,
  Globe2,
  Languages,
  Link2,
  Monitor,
  MousePointerClick,
  QrCode,
  Share2,
  Smartphone,
  Split,
  Tablet,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Favicon, Panel, Segmented } from "@/components/shared/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { countryFlag, countryName, languageName } from "@/lib/countries";
import { compactNumber, formatNumber, hostnameOf, percentChange } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Breakdown, StatsData } from "@/types";

export const PERIOD_OPTIONS = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "365d", label: "1y" },
  { value: "all", label: "All" },
];

const PERIOD_LABEL: Record<string, string> = {
  "24h": "previous 24 hours",
  "7d": "previous 7 days",
  "30d": "previous 30 days",
  "90d": "previous 90 days",
  "365d": "previous year",
};

/* ------------------------------------------------------------------ KPIs */

function KpiCard({
  icon: Icon,
  label,
  value,
  change,
  hint,
  tone = "blue",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  change?: number | null;
  hint?: string;
  tone?: "blue" | "green" | "pink" | "amber";
}) {
  const tones = {
    blue: "bg-blue-500/12 text-blue-600 dark:text-blue-300",
    green: "bg-green-500/12 text-green-600 dark:text-green-400",
    pink: "bg-pink-500/12 text-pink-600 dark:text-pink-300",
    amber: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
  };
  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-[13px] font-medium">{label}</span>
        <span className={cn("flex size-8 items-center justify-center rounded-lg", tones[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-foreground text-[28px] leading-none font-bold tracking-tight tabular-nums">
          {value}
        </span>
        {change !== undefined && change !== null && (
          <span
            className={cn(
              "mb-0.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
              change >= 0
                ? "bg-green-500/12 text-green-700 dark:text-green-400"
                : "bg-red-500/12 text-red-700 dark:text-red-400",
            )}
          >
            {change >= 0 ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      {hint && <p className="text-muted-foreground mt-1.5 text-xs">{hint}</p>}
    </Panel>
  );
}

/* ------------------------------------------------------------ timeseries */

function bucketLabel(bucket: string, granularity: StatsData["granularity"], long = false): string {
  const date = new Date(bucket);
  if (Number.isNaN(date.getTime())) return bucket;
  if (granularity === "hour") {
    return date.toLocaleString(
      "en-US",
      long ? { month: "short", day: "numeric", hour: "numeric" } : { hour: "numeric" },
    );
  }
  if (granularity === "month")
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return granularity === "week" && long ? `Week of ${label}` : label;
}

function ChartTooltip({
  active,
  payload,
  label,
  granularity,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number }>;
  label?: string;
  granularity: StatsData["granularity"];
}) {
  if (!active || !payload?.length || !label) return null;
  const get = (key: string) => payload.find((p) => p.dataKey === key)?.value ?? 0;
  return (
    <div className="border-border bg-popover rounded-xl border px-3 py-2 text-xs shadow-xl">
      <p className="text-foreground mb-1.5 font-semibold">
        {bucketLabel(label, granularity, true)}
      </p>
      <p className="text-card-foreground flex items-center gap-2">
        <span className="size-2 rounded-full bg-[#144ee3]" /> {formatNumber(get("clicks"))} clicks
      </p>
      <p className="text-card-foreground mt-0.5 flex items-center gap-2">
        <span className="size-2 rounded-full bg-[#eb568e]" /> {formatNumber(get("uniques"))} unique
      </p>
    </div>
  );
}

function TimeseriesChart({ stats }: { stats: StatsData }) {
  const data = stats.timeseries;
  const max = Math.max(0, ...data.map((d) => d.clicks));
  return (
    <Panel className="pb-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-foreground text-[15px] font-semibold">Clicks over time</h3>
          <p className="text-muted-foreground text-xs">
            Grouped by {stats.granularity}, in {stats.timezone.replace(/_/g, " ")}
          </p>
        </div>
        <div className="text-muted-foreground flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm bg-[#144ee3]" /> Clicks
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded bg-[#eb568e]" /> Unique visitors
          </span>
        </div>
      </div>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="lk-clicks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#144ee3" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#144ee3" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
            <XAxis
              dataKey="bucket"
              tickFormatter={(v: string) => bucketLabel(v, stats.granularity)}
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              domain={[0, max === 0 ? 4 : "auto"]}
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => compactNumber(v)}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
              content={<ChartTooltip granularity={stats.granularity} />}
            />
            <Area
              type="monotone"
              dataKey="clicks"
              stroke="#144ee3"
              strokeWidth={2.25}
              fill="url(#lk-clicks)"
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="uniques"
              stroke="#eb568e"
              strokeWidth={1.75}
              fill="transparent"
              strokeDasharray="5 4"
              activeDot={{ r: 3, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------ breakdowns */

interface BreakdownTab {
  value: string;
  label: string;
  rows: Breakdown[];
  render: (row: Breakdown) => { icon: React.ReactNode; label: string; sublabel?: string };
}

function BreakdownList({ rows, render }: Pick<BreakdownTab, "rows" | "render">) {
  const [expanded, setExpanded] = useState(false);
  const total = rows.reduce((sum, r) => sum + r.clicks, 0);
  const max = Math.max(1, ...rows.map((r) => r.clicks));
  const visible = expanded ? rows : rows.slice(0, 7);

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">No data for this period yet</p>
    );
  }

  return (
    <div>
      <ul className="space-y-1">
        {visible.map((row) => {
          const item = render(row);
          const share = total ? Math.round((row.clicks / total) * 100) : 0;
          return (
            <li
              key={row.key}
              className="group relative flex h-9 items-center gap-2.5 overflow-hidden rounded-lg px-2.5"
            >
              <div
                className="bg-primary/10 group-hover:bg-primary/15 absolute inset-y-0 left-0 rounded-lg transition-[width,background-color] duration-500"
                style={{ width: `${(row.clicks / max) * 100}%` }}
              />
              <span className="relative flex size-5 shrink-0 items-center justify-center">
                {item.icon}
              </span>
              <span
                className="text-foreground relative min-w-0 flex-1 truncate text-[13px]"
                title={item.label}
              >
                {item.label}
                {item.sublabel && (
                  <span className="text-muted-foreground ml-1.5 text-xs">{item.sublabel}</span>
                )}
              </span>
              <span className="text-foreground relative text-[13px] font-semibold tabular-nums">
                {formatNumber(row.clicks)}
              </span>
              <span className="text-muted-foreground relative w-9 text-right text-xs tabular-nums">
                {share}%
              </span>
            </li>
          );
        })}
      </ul>
      {rows.length > 7 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-primary mt-2 w-full cursor-pointer rounded-lg py-1.5 text-xs font-medium hover:underline"
        >
          {expanded ? "Show less" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}

function BreakdownCard({
  title,
  icon: Icon,
  tabs,
}: {
  title: string;
  icon: LucideIcon;
  tabs: BreakdownTab[];
}) {
  const [active, setActive] = useState(tabs[0].value);
  const tab = tabs.find((t) => t.value === active) ?? tabs[0];
  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-foreground flex items-center gap-2 text-[15px] font-semibold">
          <Icon className="text-muted-foreground size-4" />
          {title}
        </h3>
        {tabs.length > 1 && (
          <Segmented
            size="sm"
            value={active}
            onChange={setActive}
            options={tabs.map((t) => ({ value: t.value, label: t.label }))}
          />
        )}
      </div>
      <BreakdownList rows={tab.rows} render={tab.render} />
    </Panel>
  );
}

const DEVICE_ICONS: Record<string, LucideIcon> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
  bot: Bot,
};

const SOURCE_LABELS: Record<string, { label: string; icon: LucideIcon }> = {
  link: { label: "Short link", icon: Link2 },
  qr: { label: "QR code scan", icon: QrCode },
  bio: { label: "Bio page", icon: Share2 },
};

const iconClass = "text-muted-foreground size-4";

/* --------------------------------------------------------------- heatmap */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Heatmap({ cells }: { cells: StatsData["heatmap"] }) {
  const grid = useMemo(() => {
    const map = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.clicks]));
    return DAYS.map((_, d) => Array.from({ length: 24 }, (_, h) => map.get(`${d + 1}-${h}`) ?? 0));
  }, [cells]);
  const max = Math.max(1, ...cells.map((c) => c.clicks));
  const busiest = cells.reduce<StatsData["heatmap"][number] | null>(
    (best, c) => (!best || c.clicks > best.clicks ? c : best),
    null,
  );

  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-foreground flex items-center gap-2 text-[15px] font-semibold">
          <CalendarDays className="text-muted-foreground size-4" />
          When people click
        </h3>
        {busiest && busiest.clicks > 0 && (
          <span className="text-muted-foreground text-xs">
            Busiest: {DAYS[busiest.dow - 1]} around{" "}
            {new Date(2000, 0, 1, busiest.hour).toLocaleTimeString("en-US", { hour: "numeric" })}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          {grid.map((row, d) => (
            <div key={DAYS[d]} className="mb-1 flex items-center gap-1">
              <span className="text-muted-foreground w-8 shrink-0 text-[11px]">{DAYS[d]}</span>
              {row.map((value, h) => (
                <div
                  key={h}
                  title={`${DAYS[d]} ${h}:00 - ${value} click${value === 1 ? "" : "s"}`}
                  className="h-4 flex-1 rounded-[3px] transition-colors"
                  style={{
                    backgroundColor:
                      value === 0
                        ? "var(--secondary)"
                        : `rgba(20, 78, 227, ${0.18 + (value / max) * 0.82})`,
                  }}
                />
              ))}
            </div>
          ))}
          <div className="text-muted-foreground mt-1 flex gap-1 pl-9 text-[10px]">
            {[0, 6, 12, 18].map((h) => (
              <span key={h} className="flex-[6]">
                {new Date(2000, 0, 1, h).toLocaleTimeString("en-US", { hour: "numeric" })}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------- top links */

function TopLinks({ links }: { links: StatsData["topLinks"] }) {
  const max = Math.max(1, ...links.map((l) => l.clicks));
  return (
    <Panel>
      <h3 className="text-foreground mb-3 flex items-center gap-2 text-[15px] font-semibold">
        <Trophy className="text-muted-foreground size-4" />
        Top links
      </h3>
      {links.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">No clicks in this period</p>
      ) : (
        <ol className="space-y-1.5">
          {links.map((link, index) => (
            <li key={link.id}>
              <Link
                href={`/dashboard/links/${link.id}`}
                className="hover:bg-secondary/60 relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2 transition-colors"
              >
                <div
                  className="bg-primary/8 absolute inset-y-0 left-0"
                  style={{ width: `${(link.clicks / max) * 100}%` }}
                />
                <span className="text-muted-foreground relative w-4 text-xs font-semibold tabular-nums">
                  {index + 1}
                </span>
                <Favicon url={link.originalUrl} size={32} className="relative size-7" />
                <div className="relative min-w-0 flex-1">
                  <p className="text-foreground truncate text-[13px] font-medium">
                    {link.title || hostnameOf(link.originalUrl)}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {link.domain ? `${link.domain}/` : "/"}
                    {link.shortCode}
                  </p>
                </div>
                <div className="relative text-right">
                  <p className="text-foreground text-[13px] font-semibold tabular-nums">
                    {formatNumber(link.clicks)}
                  </p>
                  <p className="text-muted-foreground text-[11px] tabular-nums">
                    {formatNumber(link.uniques)} unique
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ view */

export function StatsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[112px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[330px] rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[300px] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

interface StatsViewProps {
  stats: StatsData;
  scope: "link" | "account" | "public";
}

export function StatsView({ stats, scope }: StatsViewProps) {
  const previousLabel = PERIOD_LABEL[stats.period];
  const clicksChange = percentChange(stats.totals.clicks, stats.previous?.clicks);
  const uniquesChange = percentChange(stats.totals.uniques, stats.previous?.uniques);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={MousePointerClick}
          label="Clicks"
          value={compactNumber(stats.totals.clicks)}
          change={clicksChange}
          hint={previousLabel ? `vs ${previousLabel}` : "All time"}
        />
        <KpiCard
          icon={Users}
          label="Unique visitors"
          value={compactNumber(stats.totals.uniques)}
          change={uniquesChange}
          hint={
            stats.totals.clicks
              ? `${(stats.totals.clicks / Math.max(1, stats.totals.uniques)).toFixed(1)} clicks per visitor`
              : undefined
          }
          tone="pink"
        />
        <KpiCard
          icon={QrCode}
          label="QR scans"
          value={compactNumber(stats.totals.qrScans)}
          hint={
            stats.totals.clicks
              ? `${Math.round((stats.totals.qrScans / stats.totals.clicks) * 100)}% of clicks`
              : "Scans of your QR codes"
          }
          tone="green"
        />
        {scope === "account" && stats.totalLinks !== undefined ? (
          <KpiCard
            icon={Link2}
            label="Links"
            value={compactNumber(stats.totalLinks)}
            hint={`${formatNumber(stats.activeLinks ?? 0)} active`}
            tone="amber"
          />
        ) : (
          <KpiCard
            icon={Bot}
            label="Bot visits"
            value={compactNumber(stats.totals.bots)}
            hint="Crawlers and previews, excluded from clicks"
            tone="amber"
          />
        )}
      </div>

      <TimeseriesChart stats={stats} />

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard
          title="Referrers"
          icon={Share2}
          tabs={[
            {
              value: "referrers",
              label: "Sites",
              rows: stats.referrers,
              render: (row) => ({
                icon:
                  row.key === "Direct" ? (
                    <Link2 className={iconClass} />
                  ) : (
                    <Favicon url={`https://${row.key}`} size={16} className="size-4 rounded" />
                  ),
                label: row.key === "Direct" ? "Direct / none" : row.key,
              }),
            },
            {
              value: "sources",
              label: "Channels",
              rows: stats.sources,
              render: (row) => {
                const meta = SOURCE_LABELS[row.key] ?? { label: row.key, icon: Link2 };
                const Icon = meta.icon;
                return { icon: <Icon className={iconClass} />, label: meta.label };
              },
            },
          ]}
        />
        <BreakdownCard
          title="Locations"
          icon={Globe2}
          tabs={[
            {
              value: "countries",
              label: "Countries",
              rows: stats.countries,
              render: (row) => ({
                icon: (
                  <span className="text-base leading-none">
                    {row.key ? countryFlag(row.key) : "🌐"}
                  </span>
                ),
                label: row.key ? countryName(row.key) : "Unknown",
              }),
            },
            {
              value: "cities",
              label: "Cities",
              rows: stats.cities,
              render: (row) => {
                const city = row as Breakdown & { country?: string | null };
                return {
                  icon: <span className="text-base leading-none">{countryFlag(city.country)}</span>,
                  label: row.key || "Unknown",
                  sublabel: city.country ? countryName(city.country) : undefined,
                };
              },
            },
            {
              value: "languages",
              label: "Languages",
              rows: stats.languages,
              render: (row) => ({
                icon: <Languages className={iconClass} />,
                label: row.key ? languageName(row.key) : "Unknown",
              }),
            },
          ]}
        />
        <BreakdownCard
          title="Technology"
          icon={Cpu}
          tabs={[
            {
              value: "devices",
              label: "Devices",
              rows: stats.devices,
              render: (row) => {
                const Icon = DEVICE_ICONS[row.key] ?? Cpu;
                return {
                  icon: <Icon className={iconClass} />,
                  label: row.key ? row.key.charAt(0).toUpperCase() + row.key.slice(1) : "Unknown",
                };
              },
            },
            {
              value: "browsers",
              label: "Browsers",
              rows: stats.browsers,
              render: (row) => ({
                icon: <Globe2 className={iconClass} />,
                label: row.key || "Unknown",
              }),
            },
            {
              value: "os",
              label: "OS",
              rows: stats.os,
              render: (row) => ({
                icon: <Monitor className={iconClass} />,
                label: row.key || "Unknown",
              }),
            },
          ]}
        />
        {scope === "account" ? (
          <TopLinks links={stats.topLinks} />
        ) : stats.destinations.length > 1 ? (
          <BreakdownCard
            title="Destinations"
            icon={Split}
            tabs={[
              {
                value: "destinations",
                label: "Split",
                rows: stats.destinations,
                render: (row) => ({
                  icon: <Favicon url={row.key} size={16} className="size-4 rounded" />,
                  label: row.key ? row.key.replace(/^https?:\/\//, "") : "Unknown",
                }),
              },
            ]}
          />
        ) : (
          <Heatmap cells={stats.heatmap} />
        )}
      </div>

      {(scope === "account" || stats.destinations.length > 1) && <Heatmap cells={stats.heatmap} />}
    </div>
  );
}

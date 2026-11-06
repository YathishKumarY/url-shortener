"use client";

import {
  Ban,
  Flag,
  Globe2,
  Link2,
  MousePointerClick,
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
import { ErrorState } from "@/components/admin/admin-shared";
import { Favicon, Panel, PanelHeader } from "@/components/shared/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminStats, type AdminStats } from "@/hooks/use-admin";
import { countryFlag, countryName } from "@/lib/countries";
import { compactNumber, formatNumber, hostnameOf } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tone = "blue" | "green" | "pink" | "amber" | "red";

const TONES: Record<Tone, string> = {
  blue: "bg-blue-500/12 text-blue-600 dark:text-blue-300",
  green: "bg-green-500/12 text-green-600 dark:text-green-400",
  pink: "bg-pink-500/12 text-pink-600 dark:text-pink-300",
  amber: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
  red: "bg-red-500/12 text-red-600 dark:text-red-300",
};

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  highlight,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  hint: React.ReactNode;
  tone: Tone;
  highlight?: boolean;
}) {
  return (
    <Panel className={cn("p-4", highlight && "border-pink-500/40 bg-pink-500/5")}>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-[13px] font-medium">{label}</span>
        <span className={cn("flex size-8 items-center justify-center rounded-lg", TONES[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p
        className={cn(
          "mt-2 text-[28px] leading-none font-bold tracking-tight tabular-nums",
          highlight ? "text-pink-600 dark:text-pink-300" : "text-foreground",
        )}
      >
        {formatNumber(value)}
      </p>
      <p className="text-muted-foreground mt-1.5 text-xs tabular-nums">{hint}</p>
    </Panel>
  );
}

function dayLabel(bucket: string, long = false) {
  const date = new Date(bucket);
  if (Number.isNaN(date.getTime())) return bucket;
  return date.toLocaleDateString(
    "en-US",
    long
      ? { weekday: "short", month: "short", day: "numeric" }
      : { month: "short", day: "numeric" },
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  const get = (key: string) => payload.find((p) => p.dataKey === key)?.value ?? 0;
  return (
    <div className="border-border bg-popover rounded-xl border px-3 py-2 text-xs shadow-xl">
      <p className="text-foreground mb-1.5 font-semibold">{dayLabel(label, true)}</p>
      <p className="text-card-foreground flex items-center gap-2 tabular-nums">
        <span className="size-2 rounded-full bg-[#144ee3]" /> {formatNumber(get("clicks"))} clicks
      </p>
      <p className="text-card-foreground mt-0.5 flex items-center gap-2 tabular-nums">
        <span className="size-2 rounded-full bg-[#eb568e]" /> {formatNumber(get("uniques"))} unique
      </p>
    </div>
  );
}

function ClicksChart({ data }: { data: AdminStats["timeseries"] }) {
  const max = Math.max(0, ...data.map((d) => d.clicks));
  return (
    <Panel className="pb-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <PanelHeader
          className="mb-0"
          title="Clicks, last 30 days"
          description="All links across the instance, grouped by day"
        />
        <div className="text-muted-foreground flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm bg-[#144ee3]" /> Clicks
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded bg-[#eb568e]" /> Unique visitors
          </span>
        </div>
      </div>
      <div
        className="h-[260px] w-full"
        role="img"
        aria-label="Area chart of clicks per day over the last 30 days"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="admin-clicks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#144ee3" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#144ee3" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
            <XAxis
              dataKey="bucket"
              tickFormatter={(v: string) => dayLabel(v)}
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
              content={<ChartTooltip />}
            />
            <Area
              type="monotone"
              dataKey="clicks"
              stroke="#144ee3"
              strokeWidth={2.25}
              fill="url(#admin-clicks)"
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

function TopLinks({ links }: { links: AdminStats["topLinks"] }) {
  return (
    <Panel>
      <PanelHeader icon={Trophy} title="Top links" description="Most clicked in the last 30 days" />
      {links.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">No clicks recorded yet</p>
      ) : (
        <ol className="space-y-1">
          {links.map((link, i) => (
            <li
              key={link.id}
              className="hover:bg-secondary/50 flex h-12 items-center gap-3 rounded-xl px-2"
            >
              <span className="text-muted-foreground w-4 text-center text-xs font-semibold tabular-nums">
                {i + 1}
              </span>
              <Favicon url={link.originalUrl} size={32} className="size-8" />
              <div className="min-w-0 flex-1">
                <p
                  className="text-foreground truncate text-sm font-medium"
                  title={link.originalUrl}
                >
                  {link.title || hostnameOf(link.originalUrl)}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {link.domain ? `${link.domain}/` : "/"}
                  {link.shortCode}
                </p>
              </div>
              <span className="text-foreground text-sm font-semibold tabular-nums">
                {compactNumber(link.clicks)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function TopCountries({ rows }: { rows: AdminStats["countries"] }) {
  const max = Math.max(1, ...rows.map((r) => r.clicks));
  return (
    <Panel>
      <PanelHeader icon={Globe2} title="Top countries" description="Clicks by visitor location" />
      {rows.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">No location data yet</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((row) => (
            <li
              key={row.key}
              className="relative flex h-9 items-center gap-2.5 overflow-hidden rounded-lg px-2.5"
            >
              <div
                className="bg-primary/10 absolute inset-y-0 left-0 rounded-lg"
                style={{ width: `${(row.clicks / max) * 100}%` }}
              />
              <span className="relative text-base leading-none" aria-hidden>
                {countryFlag(row.key)}
              </span>
              <span className="text-foreground relative min-w-0 flex-1 truncate text-sm">
                {countryName(row.key)}
              </span>
              <span className="text-foreground relative text-sm font-semibold tabular-nums">
                {compactNumber(row.clicks)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading overview">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[108px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[352px] rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[420px] rounded-2xl" />
        <Skeleton className="h-[420px] rounded-2xl" />
      </div>
    </div>
  );
}

export function OverviewTab() {
  const { data, isLoading, isError, error, refetch } = useAdminStats();

  if (isLoading) return <OverviewSkeleton />;
  if (isError || !data) return <ErrorState message={error?.message} onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi
          icon={Users}
          label="Users"
          value={data.users}
          tone="blue"
          hint={`+${formatNumber(data.newUsers24h)} in 24h`}
        />
        <Kpi
          icon={Link2}
          label="Links"
          value={data.links}
          tone="green"
          hint={`${formatNumber(data.anonymousLinks)} anonymous`}
        />
        <Kpi
          icon={MousePointerClick}
          label="Clicks"
          value={data.clicks}
          tone="blue"
          hint={`${formatNumber(data.clicks24h)} in 24h`}
        />
        <Kpi
          icon={Flag}
          label="Open reports"
          value={data.openReports}
          tone={data.openReports > 0 ? "pink" : "green"}
          highlight={data.openReports > 0}
          hint={data.openReports > 0 ? "Needs review" : "All clear"}
        />
        <Kpi
          icon={Ban}
          label="Banned users"
          value={data.bannedUsers}
          tone={data.bannedUsers > 0 ? "red" : "amber"}
          hint="Cannot sign in"
        />
        <Kpi
          icon={Ban}
          label="Banned links"
          value={data.bannedLinks}
          tone={data.bannedLinks > 0 ? "red" : "amber"}
          hint="Blocked from redirecting"
        />
      </div>
      <ClicksChart data={data.timeseries} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TopLinks links={data.topLinks} />
        <TopCountries rows={data.countries} />
      </div>
    </div>
  );
}

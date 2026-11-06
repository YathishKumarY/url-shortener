import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { StatsPeriod } from "@/lib/validators";

/**
 * Click analytics, aggregated in SQL.
 *
 * The old statistics page fetched every link's stats separately and merged
 * them in the browser - one request per link, and unique visitors were summed
 * across links (counting a person once per link they clicked). Everything
 * here is a single scoped query per dimension instead.
 *
 * Timestamps are stored as UTC wall-clock values in `timestamp` columns.
 * Bounds are passed as ISO strings and converted explicitly, so results never
 * depend on the database session's TimeZone setting.
 */

export type StatsScope = { linkId: string } | { userId: string } | { all: true };
export type Granularity = "hour" | "day" | "week" | "month";

const DAY = 86_400_000;
const PERIOD_MS: Record<Exclude<StatsPeriod, "all">, number> = {
  "24h": DAY,
  "7d": 7 * DAY,
  "30d": 30 * DAY,
  "90d": 90 * DAY,
  "365d": 365 * DAY,
};

export function resolveTimezone(tz?: string | null): string {
  if (!tz) return "UTC";
  // Raw offsets ("+05:30") pass Intl, but Postgres reads them as POSIX zones
  // with the sign inverted, so buckets would land ~11 hours off. Only IANA
  // names (which mean the same thing to both) are accepted.
  if (/^[+-]/.test(tz.trim())) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export function pickGranularity(spanMs: number): Granularity {
  if (spanMs <= 2 * DAY) return "hour";
  if (spanMs <= 120 * DAY) return "day";
  if (spanMs <= 730 * DAY) return "week";
  return "month";
}

export interface StatsRange {
  since: Date;
  until: Date;
  previous: { since: Date; until: Date } | null;
}

export function periodRange(period: StatsPeriod, now: Date, earliest: Date | null): StatsRange {
  if (period === "all") {
    const since = earliest && earliest < now ? earliest : new Date(now.getTime() - 7 * DAY);
    return { since, until: now, previous: null };
  }
  const span = PERIOD_MS[period];
  const since = new Date(now.getTime() - span);
  return { since, until: now, previous: { since: new Date(since.getTime() - span), until: since } };
}

const utc = (date: Date) => Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;

function scopeSql(scope: StatsScope): { join: Prisma.Sql; where: Prisma.Sql } {
  if ("linkId" in scope)
    return { join: Prisma.empty, where: Prisma.sql`c."linkId" = ${scope.linkId}` };
  if ("userId" in scope) {
    return {
      join: Prisma.sql`JOIN "Link" l ON l."id" = c."linkId"`,
      where: Prisma.sql`l."userId" = ${scope.userId}`,
    };
  }
  return { join: Prisma.empty, where: Prisma.sql`TRUE` };
}

function fromWhere(scope: StatsScope, since: Date, until: Date): Prisma.Sql {
  const { join, where } = scopeSql(scope);
  return Prisma.sql`FROM "Click" c ${join} WHERE ${where} AND c."timestamp" >= ${utc(since)} AND c."timestamp" < ${utc(until)}`;
}

export interface Breakdown {
  key: string;
  clicks: number;
  uniques: number;
}

export interface StatsResult {
  period: StatsPeriod;
  timezone: string;
  granularity: Granularity;
  range: { since: string; until: string };
  totals: { clicks: number; uniques: number; bots: number; qrScans: number };
  previous: { clicks: number; uniques: number } | null;
  timeseries: Array<{ bucket: string; clicks: number; uniques: number; bots: number }>;
  referrers: Breakdown[];
  countries: Breakdown[];
  cities: Array<Breakdown & { country: string | null }>;
  devices: Breakdown[];
  browsers: Breakdown[];
  os: Breakdown[];
  languages: Breakdown[];
  sources: Breakdown[];
  destinations: Breakdown[];
  heatmap: Array<{ dow: number; hour: number; clicks: number }>;
  topLinks: Array<{
    id: string;
    shortCode: string;
    domain: string | null;
    title: string | null;
    originalUrl: string;
    clicks: number;
    uniques: number;
  }>;
}

export interface StatsOptions {
  scope: StatsScope;
  period: StatsPeriod;
  timezone?: string | null;
  includeBots?: boolean;
  now?: Date;
}

async function earliestClick(scope: StatsScope): Promise<Date | null> {
  const { join, where } = scopeSql(scope);
  const rows = await prisma.$queryRaw<Array<{ first: string | null }>>`
    SELECT to_char(MIN(c."timestamp"), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS first
    FROM "Click" c ${join} WHERE ${where}`;
  return rows[0]?.first ? new Date(rows[0].first) : null;
}

export async function getStats({
  scope,
  period,
  timezone,
  includeBots = false,
  now = new Date(),
}: StatsOptions): Promise<StatsResult> {
  const tz = resolveTimezone(timezone);
  const earliest = period === "all" ? await earliestClick(scope) : null;
  const range = periodRange(period, now, earliest);
  const granularity = pickGranularity(range.until.getTime() - range.since.getTime());
  const base = fromWhere(scope, range.since, range.until);
  const human = includeBots ? Prisma.sql`TRUE` : Prisma.sql`c."isBot" = false`;
  const unit = Prisma.raw(`'${granularity}'`);
  const step = Prisma.raw(`'1 ${granularity}'`);
  const local = Prisma.sql`((c."timestamp" AT TIME ZONE 'UTC') AT TIME ZONE ${tz})`;
  const localBound = (d: Date) => Prisma.sql`(${d.toISOString()}::timestamptz AT TIME ZONE ${tz})`;

  const breakdown = (expr: Prisma.Sql, limit = 10) =>
    prisma.$queryRaw<Breakdown[]>`
      SELECT COALESCE(${expr}, '') AS key, COUNT(*)::int AS clicks, COUNT(DISTINCT c."ipHash")::int AS uniques
      ${base} AND ${human}
      GROUP BY 1 ORDER BY 2 DESC, 1 ASC LIMIT ${limit}`;

  const kpis = (from: Prisma.Sql) =>
    prisma.$queryRaw<Array<{ clicks: number; uniques: number; bots: number; qr: number }>>`
      SELECT COUNT(*) FILTER (WHERE NOT c."isBot")::int AS clicks,
             COUNT(DISTINCT c."ipHash") FILTER (WHERE NOT c."isBot")::int AS uniques,
             COUNT(*) FILTER (WHERE c."isBot")::int AS bots,
             COUNT(*) FILTER (WHERE c."source" = 'qr' AND NOT c."isBot")::int AS qr
      ${from}`;

  const referrerExpr = Prisma.sql`COALESCE(c."referrerHost", substring(c."referrer" from '^https?://(?:www\\.)?([^/:?#]+)'))`;

  const [
    totalsRows,
    previousRows,
    timeseries,
    referrers,
    countries,
    cities,
    devices,
    browsers,
    os,
    languages,
    sources,
    destinations,
    heatmap,
    topLinkRows,
  ] = await Promise.all([
    kpis(base),
    range.previous ? kpis(fromWhere(scope, range.previous.since, range.previous.until)) : null,
    prisma.$queryRaw<StatsResult["timeseries"]>`
      WITH buckets AS (
        SELECT generate_series(date_trunc(${unit}, ${localBound(range.since)}),
                               date_trunc(${unit}, ${localBound(range.until)}),
                               ${step}::interval) AS bucket
      ), data AS (
        SELECT date_trunc(${unit}, ${local}) AS bucket,
               COUNT(*) FILTER (WHERE NOT c."isBot")::int AS clicks,
               COUNT(DISTINCT c."ipHash") FILTER (WHERE NOT c."isBot")::int AS uniques,
               COUNT(*) FILTER (WHERE c."isBot")::int AS bots
        ${base}
        GROUP BY 1
      )
      SELECT to_char(b.bucket, 'YYYY-MM-DD"T"HH24:MI:SS') AS bucket,
             COALESCE(d.clicks, 0)::int AS clicks,
             COALESCE(d.uniques, 0)::int AS uniques,
             COALESCE(d.bots, 0)::int AS bots
      FROM buckets b LEFT JOIN data d ON d.bucket = b.bucket
      ORDER BY b.bucket`,
    breakdown(referrerExpr),
    breakdown(Prisma.sql`c."country"`, 50),
    prisma.$queryRaw<StatsResult["cities"]>`
      SELECT c."city" AS key, MAX(c."country") AS country, COUNT(*)::int AS clicks,
             COUNT(DISTINCT c."ipHash")::int AS uniques
      ${base} AND ${human} AND c."city" IS NOT NULL
      GROUP BY c."city" ORDER BY 3 DESC LIMIT 10`,
    breakdown(Prisma.sql`c."device"`),
    breakdown(Prisma.sql`c."browser"`),
    breakdown(Prisma.sql`c."os"`),
    breakdown(Prisma.sql`c."language"`),
    breakdown(Prisma.sql`c."source"`),
    "linkId" in scope ? breakdown(Prisma.sql`c."destination"`) : Promise.resolve([] as Breakdown[]),
    prisma.$queryRaw<StatsResult["heatmap"]>`
      SELECT EXTRACT(ISODOW FROM t.local)::int AS dow, EXTRACT(HOUR FROM t.local)::int AS hour,
             COUNT(*)::int AS clicks
      FROM (SELECT ${local} AS local ${base} AND ${human}) t
      GROUP BY 1, 2`,
    "linkId" in scope
      ? Promise.resolve([] as Array<{ id: string; clicks: number; uniques: number }>)
      : prisma.$queryRaw<Array<{ id: string; clicks: number; uniques: number }>>`
          SELECT c."linkId" AS id, COUNT(*)::int AS clicks, COUNT(DISTINCT c."ipHash")::int AS uniques
          ${base} AND ${human}
          GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
  ]);

  const linkDetails = topLinkRows.length
    ? await prisma.link.findMany({
        where: { id: { in: topLinkRows.map((r) => r.id) } },
        select: { id: true, shortCode: true, domain: true, title: true, originalUrl: true },
      })
    : [];
  const byId = new Map(linkDetails.map((l) => [l.id, l]));

  const totals = totalsRows[0] ?? { clicks: 0, uniques: 0, bots: 0, qr: 0 };
  const previous = previousRows?.[0] ?? null;

  return {
    period,
    timezone: tz,
    granularity,
    range: { since: range.since.toISOString(), until: range.until.toISOString() },
    totals: {
      clicks: totals.clicks,
      uniques: totals.uniques,
      bots: totals.bots,
      qrScans: totals.qr,
    },
    previous: previous ? { clicks: previous.clicks, uniques: previous.uniques } : null,
    timeseries,
    referrers: referrers.map((r) => ({ ...r, key: r.key || "Direct" })),
    countries,
    cities,
    devices,
    browsers,
    os,
    languages,
    sources: sources.map((s) => ({ ...s, key: s.key || "link" })),
    destinations,
    heatmap,
    topLinks: topLinkRows.flatMap((row) => {
      const link = byId.get(row.id);
      return link
        ? [{ ...link, domain: link.domain || null, clicks: row.clicks, uniques: row.uniques }]
        : [];
    }),
  };
}

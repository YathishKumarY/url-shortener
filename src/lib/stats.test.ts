import { describe, expect, it, vi } from "vitest";
import { periodRange, pickGranularity, resolveTimezone } from "@/lib/stats";

// Only the pure helpers are tested; importing the module must not need a database.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const DAY = 86_400_000;
const NOW = new Date("2026-11-06T12:00:00.000Z");

describe("resolveTimezone", () => {
  it.each(["Asia/Kolkata", "America/New_York", "Europe/London", "Australia/Lord_Howe", "UTC"])(
    "keeps the valid IANA zone %s",
    (tz) => {
      expect(resolveTimezone(tz)).toBe(tz);
    },
  );

  it.each([undefined, null, "", "Not/AZone", "garbage", "Mars/Olympus_Mons", "America/Atlantis"])(
    "falls back to UTC for %o",
    (tz) => {
      expect(resolveTimezone(tz)).toBe("UTC");
    },
  );
});

describe("pickGranularity", () => {
  it.each([
    [0, "hour"],
    [DAY, "hour"],
    [2 * DAY, "hour"],
    [2 * DAY + 1, "day"],
    [7 * DAY, "day"],
    [120 * DAY, "day"],
    [120 * DAY + 1, "week"],
    [365 * DAY, "week"],
    [730 * DAY, "week"],
    [730 * DAY + 1, "month"],
    [3650 * DAY, "month"],
  ])("buckets a span of %i ms by %s", (span, expected) => {
    expect(pickGranularity(span)).toBe(expected);
  });
});

describe("periodRange", () => {
  it.each([
    ["24h", 1],
    ["7d", 7],
    ["30d", 30],
    ["90d", 90],
    ["365d", 365],
  ] as const)("covers the last %s with an equal previous window", (period, days) => {
    const range = periodRange(period, NOW, null);
    const span = days * DAY;
    expect(range.until).toEqual(NOW);
    expect(range.since).toEqual(new Date(NOW.getTime() - span));
    expect(range.previous).toEqual({
      since: new Date(NOW.getTime() - 2 * span),
      until: new Date(NOW.getTime() - span),
    });
  });

  it("makes the previous window end exactly where the current one starts", () => {
    const range = periodRange("30d", NOW, null);
    expect(range.previous?.until.getTime()).toBe(range.since.getTime());
  });

  it("ignores the earliest click for a bounded period", () => {
    const earliest = new Date("2020-01-01T00:00:00.000Z");
    expect(periodRange("7d", NOW, earliest).since).toEqual(new Date(NOW.getTime() - 7 * DAY));
  });

  it("starts 'all' at the earliest click with no previous window", () => {
    const earliest = new Date("2024-03-15T08:30:00.000Z");
    expect(periodRange("all", NOW, earliest)).toEqual({
      since: earliest,
      until: NOW,
      previous: null,
    });
  });

  it("shows the last week for 'all' when there are no clicks yet", () => {
    expect(periodRange("all", NOW, null)).toEqual({
      since: new Date(NOW.getTime() - 7 * DAY),
      until: NOW,
      previous: null,
    });
  });

  it.each([
    ["now", 0],
    ["the future (clock skew)", 60_000],
  ])("shows the last week for 'all' when the earliest click is %s", (_label, offset) => {
    const range = periodRange("all", NOW, new Date(NOW.getTime() + offset));
    expect(range.since).toEqual(new Date(NOW.getTime() - 7 * DAY));
  });

  it.each([
    ["24h", "hour"],
    ["7d", "day"],
    ["30d", "day"],
    ["90d", "day"],
    ["365d", "week"],
  ] as const)("pairs %s with %s buckets", (period, granularity) => {
    const { since, until } = periodRange(period, NOW, null);
    expect(pickGranularity(until.getTime() - since.getTime())).toBe(granularity);
  });

  it("uses monthly buckets for 'all' over several years", () => {
    const { since, until } = periodRange("all", NOW, new Date("2022-01-01T00:00:00.000Z"));
    expect(pickGranularity(until.getTime() - since.getTime())).toBe("month");
  });
});

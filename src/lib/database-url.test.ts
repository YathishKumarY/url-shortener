import { describe, expect, it } from "vitest";
import { appDatabaseUrl, cliDatabaseUrl, databasePoolSize } from "@/lib/database-url";

const direct = "postgres://u:p@db.prisma.io:5432/postgres?sslmode=require";
const pooled = "postgres://u:p@pooled.db.prisma.io:5432/postgres?sslmode=require";

describe("appDatabaseUrl", () => {
  it("prefers the pooled string set by the Vercel Prisma Postgres integration", () => {
    expect(appDatabaseUrl({ DATABASE_URL: direct, DATABASE_URL_POOLED: pooled })).toBe(pooled);
  });

  it("falls back to DATABASE_URL", () => {
    expect(appDatabaseUrl({ DATABASE_URL: pooled, DIRECT_URL: direct })).toBe(pooled);
    expect(appDatabaseUrl({ DATABASE_URL: direct })).toBe(direct);
  });

  it("ignores blank values", () => {
    expect(appDatabaseUrl({ DATABASE_URL: direct, DATABASE_URL_POOLED: "  " })).toBe(direct);
    expect(appDatabaseUrl({})).toBeUndefined();
  });
});

describe("cliDatabaseUrl", () => {
  it("uses DIRECT_URL when DATABASE_URL is pooled", () => {
    expect(cliDatabaseUrl({ DATABASE_URL: pooled, DIRECT_URL: direct })).toBe(direct);
  });

  it("uses DATABASE_URL (direct under the Vercel integration)", () => {
    expect(cliDatabaseUrl({ DATABASE_URL: direct, DATABASE_URL_POOLED: pooled })).toBe(direct);
  });
});

describe("databasePoolSize", () => {
  it("honours DATABASE_POOL_SIZE", () => {
    expect(databasePoolSize({ DATABASE_POOL_SIZE: "5", VERCEL: "1" })).toBe(5);
  });

  it("keeps serverless instances small and servers at 10", () => {
    expect(databasePoolSize({ VERCEL: "1" })).toBe(2);
    expect(databasePoolSize({})).toBe(10);
    expect(databasePoolSize({ DATABASE_POOL_SIZE: "", VERCEL: "1" })).toBe(2);
    expect(databasePoolSize({ DATABASE_POOL_SIZE: "abc" })).toBe(10);
  });
});

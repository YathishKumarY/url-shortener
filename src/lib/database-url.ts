/**
 * Which connection string each part of Linkly uses.
 *
 * Hosted Postgres with a connection pooler (Prisma Postgres, Supabase, Neon's
 * "-pooler" host) gives out two strings for the same database: a pooled one
 * for application traffic and a direct one for schema changes and tools such
 * as pg_dump. Serverless functions must use the pooled string, because every
 * instance opens its own connections and the direct limit is small (10 on the
 * Prisma Postgres Free plan).
 *
 * Two naming conventions are supported, so either setup works unchanged:
 * - Vercel's Prisma Postgres integration: DATABASE_URL is direct and
 *   DATABASE_URL_POOLED is pooled.
 * - Manual setup: DATABASE_URL is pooled and DIRECT_URL is direct.
 * A single DATABASE_URL (Docker, a local install) is used for everything.
 *
 * No imports, so prisma.config.ts can load this file too.
 */

type Env = Record<string, string | undefined>;

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Connection string for the running app: the pooled one when it exists. */
export function appDatabaseUrl(env: Env = process.env): string | undefined {
  return clean(env.DATABASE_URL_POOLED) ?? clean(env.DATABASE_URL);
}

/** Connection string for Prisma CLI work (db push, migrations): always direct. */
export function cliDatabaseUrl(env: Env = process.env): string | undefined {
  return clean(env.DIRECT_URL) ?? clean(env.DATABASE_URL);
}

/**
 * Connections each app instance may open. A long-running server can hold a
 * real pool; on Vercel many short-lived instances share one database, so each
 * keeps two and the total stays inside small connection limits.
 */
export function databasePoolSize(env: Env = process.env): number {
  const configured = Number(env.DATABASE_POOL_SIZE);
  if (Number.isFinite(configured) && configured > 0) return Math.floor(configured);
  return env.VERCEL ? 2 : 10;
}

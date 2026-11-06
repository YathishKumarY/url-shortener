import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { appDatabaseUrl, databasePoolSize } from "@/lib/database-url";

const globalForPrisma = globalThis as unknown as { prisma: InstanceType<typeof PrismaClient> };

function isNeonHost(connectionString: string): boolean {
  try {
    return new URL(connectionString).hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

/**
 * Neon's serverless driver talks WebSockets/HTTP, which only Neon (or a Neon
 * proxy) understands. Any other Postgres - Docker, RDS, Supabase, a local
 * install - needs the ordinary TCP driver. Choosing by host means
 * self-hosting works without code changes; DATABASE_DRIVER=neon|pg overrides.
 */
function createAdapter(connectionString: string) {
  const driver = process.env.DATABASE_DRIVER?.trim().toLowerCase();
  const useNeon = driver === "neon" || (driver !== "pg" && isNeonHost(connectionString));
  if (useNeon) return new PrismaNeon({ connectionString });

  return new PrismaPg({ connectionString, max: databasePoolSize() });
}

function createPrismaClient() {
  // Pooled string when the host provides one (see src/lib/database-url.ts).
  return new PrismaClient({ adapter: createAdapter(appDatabaseUrl()!) });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

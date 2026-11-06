import dotenv from "dotenv";
import { defineConfig } from "prisma/config";
import { cliDatabaseUrl } from "./src/lib/database-url";

dotenv.config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Schema changes need a direct connection, never a pooler.
    url: cliDatabaseUrl()!,
  },
});

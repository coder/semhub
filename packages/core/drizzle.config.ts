import type { Config } from "drizzle-kit";
import { defineConfig } from "drizzle-kit";
import { Resource } from "sst";

export default defineConfig({
  strict: true,
  verbose: true,
  dialect: "postgresql",
  dbCredentials: {
    // @ts-ignore Resource will be available during runtime
    url: Resource.DATABASE_URL.value,
  },
  schema: "src/**/*.sql.ts",
  out: "migrations",
} satisfies Config);

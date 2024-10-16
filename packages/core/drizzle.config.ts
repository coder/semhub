import { defineConfig } from "drizzle-kit";
import { Resource } from "sst";

export default defineConfig({
  strict: true,
  verbose: true,
  dialect: "postgresql",
  dbCredentials: {
    url: Resource.Supabase.databaseUrl,
  },
  schema: "./src/**/*.sql.ts",
  out: "./migrations",
});

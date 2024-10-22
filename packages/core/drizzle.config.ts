import path from "path";
import { defineConfig } from "drizzle-kit";
import { Resource } from "sst";

export default defineConfig({
  strict: true,
  verbose: true,
  dialect: "postgresql",
  dbCredentials: {
    url: Resource.Supabase.databaseUrl,
  },
  schema: path.join(__dirname, "src/**/*.sql.ts"),
  out: path.join(__dirname, "migrations"),
});

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { Resource } from "sst";

export * from "drizzle-orm";

// Initialize db lazily
export function getDb() {
  const connectionString = Resource.Supabase.databaseUrl;
  // Disable prefetch as it is not supported for "Transaction" pool mode
  const client = postgres(connectionString, { prepare: false });
  return {
    db: drizzle(client),
    closeConnection: async () => await client.end(),
  };
}

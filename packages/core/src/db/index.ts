import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { Resource } from "sst";

export * from "drizzle-orm";

let client: postgres.Sql | null = null;

function getClient() {
  if (client) return client;
  const connectionString = Resource.Supabase.databaseUrl;
  // Disable prefetch as it is not supported for "Transaction" pool mode
  client = postgres(connectionString, { prepare: false });
  return client;
}

// Initialize db lazily
export function getDrizzle() {
  return drizzle(getClient());
}

export const closeConnection = async () => {
  if (client) {
    await client.end();
    client = null;
  }
};

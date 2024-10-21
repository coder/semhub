import { drizzle } from "drizzle-orm/postgres-js";

import postgres from "postgres";
import { Resource } from "sst";

export * from "drizzle-orm";

const connectionString = Resource.Supabase.databaseUrl;

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client);

export const closeConnection = async () => {
  await client.end();
};

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { EmbeddingAwareLogger } from "./logger";

export * from "drizzle-orm";

export function createDb(config: {
  connectionString: string;
  isProd: boolean;
  options?: postgres.Options<{}>;
}) {
  const client = postgres(config.connectionString, {
    // Disable prepare as it is not supported for "Transaction" pool mode
    prepare: false,
    ...config.options,
  });
  return {
    db: drizzle(client, {
      logger: !config.isProd && new EmbeddingAwareLogger(),
    }),
    // used to close connection when running scripts
    closeConnection: async () => await client.end(),
  };
}

export type DbClient = ReturnType<typeof createDb>["db"];

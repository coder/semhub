import type { Logger } from "drizzle-orm/logger";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { Resource } from "sst";

export * from "drizzle-orm";

// Custom logger that simplifies embedding arrays in logs
class EmbeddingAwareLogger implements Logger {
  logQuery(query: string, params: unknown[]): void {
    // Ensure params is an array
    const paramsArray = Array.isArray(params) ? params : [params];

    // Simplify parameters by replacing large arrays with placeholders
    const simplifiedParams = paramsArray.map((param, index) => {
      // Check if it's a string that starts with [ and ends with ]
      if (
        typeof param === "string" &&
        param.startsWith("[") &&
        param.endsWith("]")
      ) {
        try {
          const array = JSON.parse(param);
          if (Array.isArray(array) && array.length > 10) {
            return `$${index + 1}=[Embedding Array: length=${array.length}]`;
          }
        } catch (e) {
          // If JSON.parse fails, return original param
          return param;
        }
      }
      return param;
    });

    console.log({ query, params: simplifiedParams });
  }
}

// Initialize db lazily
export function getDb() {
  const connectionString = Resource.Supabase.databaseUrl;
  const isProd = Resource.App.stage === "prod";
  const client = postgres(connectionString, { prepare: false });
  return {
    db: drizzle(client, {
      logger: !isProd && new EmbeddingAwareLogger(),
    }),
    closeConnection: async () => await client.end(),
  };
}

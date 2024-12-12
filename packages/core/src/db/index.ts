import type { Logger } from "drizzle-orm/logger";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

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
        } catch (_) {
          // If JSON.parse fails, return original param
          return param;
        }
      }
      return param;
    });

    console.log({ query, params: simplifiedParams });
  }
}

export function createDb(config: {
  connectionString: string;
  isProd: boolean;
}) {
  // Disable prefetch as it is not supported for "Transaction" pool mode
  const client = postgres(config.connectionString, { prepare: false });
  return {
    db: drizzle(client, {
      logger: !config.isProd && new EmbeddingAwareLogger(),
    }),
    // used to close connection when running scripts
    closeConnection: async () => await client.end(),
  };
}

export type DbClient = ReturnType<typeof createDb>["db"];

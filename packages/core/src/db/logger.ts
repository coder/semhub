import type { Logger } from "drizzle-orm/logger";

// Custom logger that simplifies embedding arrays in logs
export class EmbeddingAwareLogger implements Logger {
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

    // eslint-disable-next-line no-console
    console.log({ query, params: simplifiedParams });
  }
}

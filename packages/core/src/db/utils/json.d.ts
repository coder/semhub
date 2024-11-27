// Type to get nested path types
import { type PgColumn } from "drizzle-orm/pg-core";

export type PathsToStringProperty<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends string | number | null
        ? K
        : T[K] extends object
          ? `${K & string}.${PathsToStringProperty<T[K]>}`
          : never;
    }[keyof T & string]
  : never;

// Helper type to extract the data type from a PgColumn
export type ExtractColumnData<T> =
  T extends PgColumn<infer Config, any, any>
    ? Config extends { data: any }
      ? Config["data"]
      : never
    : never;

// Helper type for array paths
export type PathsToStringPropertyInArray<T> =
  T extends Array<infer U>
    ? PathsToStringProperty<U>
    : T extends object
      ? {
          [K in keyof T & string]: T[K] extends Array<infer U>
            ? `${K}.${PathsToStringPropertyInArray<U>}`
            : T[K] extends string | number | null
              ? K
              : T[K] extends object
                ? `${K}.${PathsToStringProperty<T[K]>}`
                : never;
        }[keyof T & string]
      : never;

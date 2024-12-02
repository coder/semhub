// This declaration only affects files in src/wrangler and its subdirectories
declare module "sst" {
  export const Resource: never;
  export type * from "sst"; // Preserve other types
}

import type { CronPatterns } from "@/infra/types";

export const CRON_PATTERNS = {
  INIT: "*/5 * * * *",
  SYNC_ISSUE: "*/20 * * * *",
  SYNC_EMBEDDING: "0 * * * *",
} as const satisfies CronPatterns;

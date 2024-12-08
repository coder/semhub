import type { CronPatterns } from "@/infra/types";

export const CRON_PATTERNS = {
  INIT: "*/5 * * * *",
  SYNC_ISSUE: "*/10 * * * *",
  SYNC_EMBEDDING: "*/15 * * * *",
} as const satisfies CronPatterns;

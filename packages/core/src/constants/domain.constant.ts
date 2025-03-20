import type { DomainStages } from "@/infra/types";

export const STAGES = {
  PROD: "prod",
  STG: "stg",
  UAT: "uat",
} as const satisfies DomainStages;

export const APP_DOMAIN = "semhub.dev";
export const LOCAL_DEV_DOMAIN = `local.${APP_DOMAIN}`;
export const APP_STG_DOMAIN = `stg.${APP_DOMAIN}`;
export const APP_UAT_DOMAIN = `uat.${APP_DOMAIN}`;

export type CronPatterns = {
  readonly INIT: "*/5 * * * *";
  readonly SYNC_ISSUE: "*/20 * * * *";
  readonly SYNC_EMBEDDING: "0 * * * *";
};

export type DomainStages = {
  readonly PROD: "prod";
  readonly STG: "stg";
  readonly UAT: "uat";
};

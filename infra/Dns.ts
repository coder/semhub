import type { DomainStages } from "./types";

export const STAGES = {
  PROD: "prod",
  STG: "stg",
  UAT: "uat",
} as const satisfies DomainStages;

const BASE_DOMAIN = "semhub.dev";

export const domain =
  {
    [STAGES.PROD]: BASE_DOMAIN,
    [STAGES.STG]: `stg.${BASE_DOMAIN}`,
    [STAGES.UAT]: `uat.${BASE_DOMAIN}`,
  }[$app.stage] || $app.stage + ".stg.semhub.dev";

// export const zone = cloudflare.getZoneOutput({
//   name: "semhub.dev",
// });

// export const outputs = {
//   domain,
// };

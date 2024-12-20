import type { CookieOptions } from "hono/utils/cookie";

export const githubLogin = {
  provider: "github-login" as const,
  scopes: ["user:email", "read:user"], // actually I suspect read:user is not necessary
};

export const githubRepo = {
  githubRepo: {
    provider: "github-repo" as const,
    scopes: ["repo"],
  },
};

export const APP_DOMAIN = "semhub.dev";
const APP_STG_DOMAIN = `stg.${APP_DOMAIN}`;

function getCookieDomain(stage: string): string {
  switch (stage) {
    case "prod":
      return APP_DOMAIN;
    case "stg":
      return APP_STG_DOMAIN;
    default:
      return ".semhub.dev"; // default to available across all domains, but might screw up your stg/prod
  }
}

export function getCookieOptions(stage: string): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    domain: getCookieDomain(stage),
    maxAge: 60 * 60,
  };
}

// cannot use wildcard if CORS "credentials: include" is used
export function getCORSAllowedOriginsOnApi() {
  return [
    `https://${APP_DOMAIN}`,
    `https://${APP_STG_DOMAIN}`,
    `https://www.${APP_DOMAIN}`,
  ];
}

export function getCORSAllowedOriginsOnAuth(stage: string) {
  return [
    `https://api.${stage}.${APP_STG_DOMAIN}`,
    `https://api.${APP_DOMAIN}`,
    `https://api.${APP_STG_DOMAIN}`,
  ];
}

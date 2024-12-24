import type { CookieOptions } from "hono/utils/cookie";

import { GITHUB_SCOPES_PERMISSION } from "@/core/github/permission";

export const githubLogin = {
  provider: "github-login" as const,
  scopes: [
    GITHUB_SCOPES_PERMISSION.userEmail,
    GITHUB_SCOPES_PERMISSION.readUser,
  ], // actually I suspect read:user is not necessary
};

export const githubRepo = {
  provider: "github-repo" as const,
  scopes: [GITHUB_SCOPES_PERMISSION.repo],
};

export const APP_DOMAIN = "semhub.dev";
const APP_STG_DOMAIN = `stg.${APP_DOMAIN}`;
const LOCAL_DEV_DOMAIN = `local.${APP_DOMAIN}`;

function getCookieDomain(stage: string) {
  switch (stage) {
    case "prod":
      return APP_DOMAIN;
    case "stg":
      return APP_STG_DOMAIN;
    default:
      // For local development, we set the cookie on the parent domain (.semhub.dev) because:
      // 1. The auth server runs on api.{stage}.stg.semhub.dev and the frontend runs on local.semhub.dev
      // 2. Cookies are only accessible within the exact domain and its subdomains, they cannot be accessed across "sibling" domains
      // 3. Using .semhub.dev allows the frontend to access the cookie
      // BUT: this might interfere with stg and prod, so be careful
      return `.${APP_DOMAIN}`;
  }
}

function isLocalDev(stage: string): boolean {
  return stage !== "prod" && stage !== "stg";
}

export function getCookieOptions(stage: string): CookieOptions {
  // see this: https://stackoverflow.com/a/46412839
  return {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    domain: getCookieDomain(stage),
    // TODO: nice flow for prompting user to re-login
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}

export function getAuthServerCORS() {
  return {
    credentials: false,
    // can use wildcard if credentials: false is used
    origin: `https://*.${APP_DOMAIN}`,
    allowHeaders: ["Content-Type"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length", "Access-Control-Allow-Origin"],
    maxAge: 600,
  };
}

export function getApiServerCORS(stage: string) {
  // cannot use wildcard if CORS "credentials: include" is used
  const origins = [
    `https://${APP_DOMAIN}`,
    `https://${APP_STG_DOMAIN}`,
    `https://www.${APP_DOMAIN}`,
  ];
  if (isLocalDev(stage)) {
    origins.push(`https://${LOCAL_DEV_DOMAIN}:3001`); // port number is required for CORS
  }
  return {
    credentials: true,
    origin: origins,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length", "Access-Control-Allow-Origin"],
    maxAge: 600,
  };
}

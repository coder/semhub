import { type cors } from "hono/cors";
import type { CookieOptions } from "hono/utils/cookie";

import { GITHUB_SCOPES_PERMISSION } from "@/core/github/permission/oauth";

// Extract CORSOptions type from cors function
type CORSOptions = NonNullable<Parameters<typeof cors>[0]>;

export const githubLogin = {
  provider: "github-login" as const,
  scopes: [
    GITHUB_SCOPES_PERMISSION.userEmail,
    GITHUB_SCOPES_PERMISSION.readUser, // actually I suspect read:user is not necessary
  ],
};

// TODO: extract these to somewhere else

const STG_STAGE = "stg";
const UAT_STAGE = "uat";
const PROD_STAGE = "prod";

export const DEPLOYED_STAGES = [STG_STAGE, UAT_STAGE, PROD_STAGE];

export const APP_DOMAIN = "semhub.dev";
const LOCAL_DEV_DOMAIN = `local.${APP_DOMAIN}`;
const APP_STG_DOMAIN = `stg.${APP_DOMAIN}`;
const APP_UAT_DOMAIN = `uat.${APP_DOMAIN}`;

function getCookieDomain(stage: string) {
  switch (stage) {
    case PROD_STAGE:
      return APP_DOMAIN;
    case UAT_STAGE:
      return APP_UAT_DOMAIN;
    case STG_STAGE:
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
  return stage !== "prod" && stage !== "stg" && stage !== "uat";
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
    allowHeaders: [
      "Content-Type",
      "sentry-trace", // Allow Sentry tracing headers
      "baggage", // Allow Sentry baggage header
    ],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length", "Access-Control-Allow-Origin"],
    maxAge: 600,
  } satisfies CORSOptions;
}

export function getApiServerCORS(stage: string) {
  // cannot use wildcard if CORS "credentials: include" is used
  const origins = [
    `https://${APP_DOMAIN}`,
    `https://${APP_STG_DOMAIN}`,
    `https://${APP_UAT_DOMAIN}`,
    `https://www.${APP_DOMAIN}`,
  ];
  if (isLocalDev(stage)) {
    origins.push(`https://${LOCAL_DEV_DOMAIN}:3001`); // port number is required for CORS
  }
  return {
    credentials: true,
    origin: origins,
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "sentry-trace", // Allow Sentry tracing headers
      "baggage", // Allow Sentry baggage header
    ],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length", "Access-Control-Allow-Origin"],
    maxAge: 600,
  } satisfies CORSOptions;
}

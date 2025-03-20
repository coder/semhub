import { type cors } from "hono/cors";
import type { CookieOptions } from "hono/utils/cookie";

import {
  APP_DOMAIN,
  APP_STG_DOMAIN,
  APP_UAT_DOMAIN,
  LOCAL_DEV_DOMAIN,
  STAGES,
} from "@/core/constants/domain.constant";
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

function getCookieDomain(stage: string) {
  switch (stage) {
    case STAGES.PROD:
      return APP_DOMAIN;
    case STAGES.UAT:
      return APP_UAT_DOMAIN;
    case STAGES.STG:
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
  return stage !== STAGES.PROD && stage !== STAGES.STG && stage !== STAGES.UAT;
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

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

function getCookieDomain(stage: string) {
  switch (stage) {
    case "prod":
      return APP_DOMAIN;
    case "stg":
      return APP_STG_DOMAIN;
    default:
      return undefined;
  }
}

function isLocalDev(stage: string): boolean {
  return stage !== "prod" && stage !== "stg";
}

export function getCookieOptions(stage: string): CookieOptions {
  const isLocal = isLocalDev(stage);
  return {
    httpOnly: true,
    secure: !isLocal,
    sameSite: isLocal ? "None" : "Strict",
    path: "/",
    domain: getCookieDomain(stage),
    maxAge: 60 * 60,
  };
}

export function getAuthServerCORS(stage: string) {
  // can use wildcard if CORS "credentials: include" is not used
  const origins = [`https://*.${APP_DOMAIN}`];
  if (isLocalDev(stage)) {
    origins.push(`http://localhost:3001`);
  }
  return {
    credentials: false,
    origin: origins,
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
    origins.push(`http://localhost:3001`);
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

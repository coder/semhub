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

export const allowedDomains = {
  prod: "semhub.dev",
  dev: {
    host: "localhost",
    port: "3001",
  },
} as const;

// cannot use wildcard if CORS "credentials: include" is used
export function getAllowedOriginsOnApi() {
  // TODO: list more domains in the future if we have staging
  return [
    `https://${allowedDomains.prod}`,
    `https://www.${allowedDomains.prod}`,
    `http://${allowedDomains.dev.host}:${allowedDomains.dev.port}`,
  ];
}

export function getAllowedOriginsOnAuth(stage: string) {
  // TODO: list more domains in the future if we have staging
  return [
    `https://api.${stage}.stg.${allowedDomains.prod}`,
    `https://api.${allowedDomains.prod}`,
    `http://${allowedDomains.dev.host}:${allowedDomains.dev.port}`,
  ];
}

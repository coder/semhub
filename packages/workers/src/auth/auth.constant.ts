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
  stg: "stg.semhub.dev",
  dev: {
    host: "localhost",
    port: "3001",
  },
} as const;

// cannot use wildcard if CORS "credentials: include" is used
export function getAllowedOriginsOnApi() {
  return [
    `https://${allowedDomains.prod}`,
    `https://${allowedDomains.stg}`,
    `https://www.${allowedDomains.prod}`,
    `http://${allowedDomains.dev.host}:${allowedDomains.dev.port}`,
  ];
}

export function getAllowedOriginsOnAuth(stage: string) {
  return [
    `https://api.${stage}.stg.${allowedDomains.prod}`,
    `https://api.${allowedDomains.stg}`,
    `https://api.${allowedDomains.prod}`,
    `http://${allowedDomains.dev.host}:${allowedDomains.dev.port}`,
  ];
}

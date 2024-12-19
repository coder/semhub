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

export function getAllowedOrigins() {
  return [
    `https://${allowedDomains.prod}`,
    `https://*.${allowedDomains.prod}`,
    `http://${allowedDomains.dev.host}:${allowedDomains.dev.port}`,
  ] as const;
}

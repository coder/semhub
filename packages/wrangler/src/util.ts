import type { WranglerEnv } from "@/core/constants/wrangler.constant";

export function getEnvPrefix(env: WranglerEnv["ENVIRONMENT"]) {
  return `[${env.toLocaleUpperCase()}]`;
}

/// <reference types="bun-types" />
// this is a script to deploy cloudflare resources
// not meant to be referenced by other parts of the codebase

import { execSync } from "child_process";
import { Resource } from "sst";

import type { WranglerSecrets } from "@/core/constants/wrangler.constant";

async function deploy() {
  const wranglerArgs = process.argv.slice(2);
  const loadEnvVars = wranglerArgs.includes("--load-env");
  // Remove the --load-env flag from args if present
  const filteredArgs = wranglerArgs
    .filter((arg) => arg !== "--load-env")
    .join(" ");
  const isProd = filteredArgs.includes("prod");
  // let's ignore staging for now, staging workers will bind to same wrangler workers as dev
  const env = isProd ? "prod" : "dev";

  const envFlag = isProd ? "--env prod" : "";
  const cloudflareEnvVars = `CF_ACCOUNT_ID=${process.env.CLOUDFLARE_ACCOUNT_ID} CF_API_TOKEN=${process.env.CLOUDFLARE_API_TOKEN}`;

  console.log(`Running wrangler ${filteredArgs} for ${env} environment`);
  try {
    // run the command: could be dev, deploy, delete
    execSync(`${cloudflareEnvVars} wrangler ${filteredArgs}`, {
      stdio: "inherit",
    });
    if (loadEnvVars && filteredArgs.startsWith("deploy")) {
      // Extract config path from arguments
      const configMatch = filteredArgs.match(/--config\s+([^\s]+)/);
      const configPath = configMatch ? `--config ${configMatch[1]}` : "";
      // Then add the secrets with the config path
      const secrets: WranglerSecrets = {
        DATABASE_URL: Resource.DATABASE_URL.value,
        OPENAI_API_KEY: Resource.OPENAI_API_KEY.value,
        GITHUB_PERSONAL_ACCESS_TOKEN:
          Resource.GITHUB_PERSONAL_ACCESS_TOKEN.value,
        RESEND_API_KEY: Resource.RESEND_API_KEY.value,
        SEMHUB_GITHUB_APP_PRIVATE_KEY:
          Resource.SEMHUB_GITHUB_APP_PRIVATE_KEY.value,
        SEMHUB_GITHUB_APP_ID: Resource.SEMHUB_GITHUB_APP_ID.value,
      };
      for (const [key, value] of Object.entries(secrets)) {
        execSync(
          `echo "${value}" | ${cloudflareEnvVars} wrangler secret put ${key} ${configPath} ${envFlag}`,
          {
            stdio: "inherit",
          },
        );
      }
    }
    console.log("Done!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

deploy();

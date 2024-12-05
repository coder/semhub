/// <reference types="bun-types" />
// this is a script to deploy cloudflare resources
// not meant to be referenced by other parts of the codebase
import { execSync } from "child_process";

// import { Resource } from "sst";

// import type { WranglerSecrets } from "@/core/constants/wrangler";

async function deploy() {
  const wranglerArgs = process.argv.slice(2).join(" ");
  const isProd = wranglerArgs.includes("prod");
  const env = isProd ? "prod" : "dev";
  const _envFlag = isProd ? "--env prod" : "";
  const cloudflareEnvVars = `CF_ACCOUNT_ID=${process.env.CLOUDFLARE_ACCOUNT_ID} CF_API_TOKEN=${process.env.CLOUDFLARE_API_TOKEN}`;

  console.log(`Running wrangler ${wranglerArgs} for ${env} environment`);
  try {
    // run the command: could be dev, deploy, delete
    execSync(`${cloudflareEnvVars} wrangler ${wranglerArgs}`, {
      stdio: "inherit",
    });
    // if (wranglerArgs.startsWith("deploy")) {
    //   // Extract config path from arguments
    //   const configMatch = wranglerArgs.match(/--config\s+([^\s]+)/);
    //   const configPath = configMatch ? `--config ${configMatch[1]}` : "";
    //   // Then add the secrets with the config path
    //   const secrets: WranglerSecrets = {
    //     DATABASE_URL: Resource.Supabase.databaseUrl,
    //     OPENAI_API_KEY: Resource.OPENAI_API_KEY.value,
    //     GITHUB_PERSONAL_ACCESS_TOKEN:
    //       Resource.GITHUB_PERSONAL_ACCESS_TOKEN.value,
    //   };
    //   for (const [key, value] of Object.entries(secrets)) {
    //     execSync(
    //       `echo "${value}" | ${cloudflareEnvVars} wrangler secret put ${key} ${configPath} ${envFlag}`,
    //       {
    //         stdio: "inherit",
    //       },
    //     );
    //   }
    // }
    console.log("Done!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

deploy();

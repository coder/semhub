/// <reference types="bun-types" />
// this is a script to deploy cloudflare resources
// not meant to be referenced by other parts of the codebase
import { execSync } from "child_process";

async function deploy() {
  // Get command line arguments
  const wranglerArgs = process.argv.slice(2).join(" ");
  console.log(`Running wrangler ${wranglerArgs}`);

  try {
    execSync(
      `CF_API_TOKEN=${process.env.CLOUDFLARE_API_TOKEN} wrangler ${wranglerArgs}`,
      { stdio: "inherit" },
    );
    console.log("Done!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

deploy();

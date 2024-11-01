import { execSync } from "child_process";
import { Resource } from "sst/resource";

async function deploy() {
  // Get command line arguments
  const wranglerArgs = process.argv.slice(2).join(" ");
  console.log(`Running wrangler ${wranglerArgs}`);

  try {
    execSync(`export CLOUDFLARE_API_TOKEN=${process.env.CLOUDFLARE_API_TOKEN}`);
    execSync(`wrangler ${wranglerArgs}`, { stdio: "inherit" });
    console.log("Done!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

deploy();

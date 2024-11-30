import { execSync } from "child_process";

async function deploy() {
  // Get command line arguments
  const wranglerArgs = process.argv.slice(2).join(" ");
  console.log(`Running wrangler ${wranglerArgs}`);

  try {
    execSync(
      `CF_ACCOUNT_ID=${process.env.CF_ACCOUNT_ID} CF_API_TOKEN=${process.env.CLOUDFLARE_API_TOKEN} wrangler ${wranglerArgs}`,
      { stdio: "inherit" },
    );
    console.log("Done!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

deploy();

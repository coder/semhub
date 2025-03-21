#!/usr/bin/env bun
/**
 * Deploy script for Cloudflare Workers
 *
 * Examples:
 * # Deploy single targets
 * bun deploy.ts workflows-sync
 * bun deploy.ts workflows-background
 *
 * # Deploy with flags
 * bun deploy.ts workflows-sync --prod      # Deploy to production
 * bun deploy.ts workflows-sync --uat       # Deploy to UAT
 * bun deploy.ts workflows-sync --load-env  # Deploy with env vars
 * bun deploy.ts all --prod --load-env      # Deploy all to prod with env vars
 *
 * # Deploy everything
 * bun deploy.ts all                        # Deploy all to dev
 * bun deploy.ts all --prod                 # Deploy all to prod
 * bun deploy.ts all --uat                  # Deploy all to UAT
 *
 * # Using with package.json, e.g.
 * bun run deploy all --prod --load-env     # Same as: bun deploy.ts all
 * bun run deploy workflows-sync --prod     # Deploy workflows-sync to prod
 */
import { z } from "zod";

const TargetSchema = z.enum(["workflows-sync", "workflows-background", "all"]);
const FlagSchema = z.object({
  prod: z.boolean().default(false),
  uat: z.boolean().default(false),
  loadEnv: z.boolean().default(false),
});

type Target = z.infer<typeof TargetSchema>;
type Flags = z.infer<typeof FlagSchema>;

const SYNC_WORKFLOWS = ["embedding", "issue", "repo-init"];

async function deployTarget(target: Target, flags: Flags) {
  const { prod, uat, loadEnv } = flags;
  const prodFlag = prod ? "--prod" : "";
  const uatFlag = uat ? "--uat" : "";
  const envFlag = loadEnv ? "--load-env" : "";

  const deployCmd = `bun scripts/worker.ts deploy ${prodFlag} ${uatFlag} ${envFlag}`;

  switch (target) {
    case "workflows-sync":
      for (const workflow of SYNC_WORKFLOWS) {
        await Bun.spawn(
          ["sh", "-c", `${deployCmd} workflows/sync/${workflow}`],
          {
            stdout: "inherit",
            stderr: "inherit",
          },
        ).exited;
      }
      break;
    case "workflows-background":
      await Bun.spawn(["sh", "-c", `${deployCmd} workflows/background`], {
        stdout: "inherit",
        stderr: "inherit",
      }).exited;
      break;
    case "all":
      await deployTarget("workflows-sync", flags);
      await deployTarget("workflows-background", flags);
      break;
  }
}

try {
  const args = process.argv.slice(2);
  const target = TargetSchema.parse(args[0]);
  const flags = FlagSchema.parse({
    prod: args.includes("--prod"),
    uat: args.includes("--uat"),
    loadEnv: args.includes("--load-env"),
  });

  await deployTarget(target, flags);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("Invalid arguments:");
    console.error(error.errors.map((e) => `- ${e.message}`).join("\n"));
    console.error(
      "\nUsage: bun deploy.ts <target> [--prod] [--uat] [--load-env]",
    );
    console.error("Targets: workflows-sync, workflows-background, all");
  } else {
    console.error("An unexpected error occurred:", error);
  }
  process.exit(1);
}

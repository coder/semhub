/// <reference types="bun-types" />
import { z } from "zod";

const ActionSchema = z.enum(["dev", "deploy", "delete"]);
const WorkerSchema = z
  .string()
  .regex(/^workflows\/[a-zA-Z0-9-]+(?:\/[a-zA-Z0-9-]+)*$/, {
    message: "Invalid workflow path format. Example: workflows/sync-repo/cron",
  });

const ArgsSchema = z.object({
  action: ActionSchema,
  worker: WorkerSchema,
  prod: z.boolean().optional().default(false),
  uat: z.boolean().optional().default(false),
  loadEnv: z.boolean().optional().default(false),
});

try {
  const args = process.argv.slice(2); // remove bun and script path
  const isProd = args.includes("--prod");
  const isUat = args.includes("--uat");
  const loadEnv = args.includes("--load-env");
  const cleanArgs = args.filter(
    (arg) => !["--prod", "--uat", "--load-env"].includes(arg),
  );

  const { action, worker, prod, uat } = ArgsSchema.parse({
    action: cleanArgs[0],
    worker: cleanArgs[1],
    prod: isProd,
    uat: isUat,
    loadEnv: loadEnv,
  });

  const stageFlag = prod ? "--stage prod" : uat ? "--stage uat" : "";
  const envFlag = prod ? "--env prod" : uat ? "--env uat" : "";
  const loadEnvFlag = loadEnv ? "--load-env" : "";
  const configPath = `--config src/${worker}/wrangler.toml`;
  const command = `sst shell ${stageFlag} -- bun scripts/wrangler.ts ${action} ${configPath} ${envFlag} ${loadEnvFlag}`;

  const proc = Bun.spawn(["sh", "-c", command], {
    stdout: "inherit",
    stderr: "inherit",
  });

  await proc.exited;
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("Invalid arguments:");
    console.error(
      error.errors.map((e) => `- ${e.path.join(".")}: ${e.message}`).join("\n"),
    );
    console.error(
      "\nUsage: bun worker.ts <dev|deploy|delete> <workflows/path/to/worker> [--prod] [--uat] [--load-env]",
    );
  } else {
    console.error("An unexpected error occurred:", error);
  }
  process.exit(1);
}

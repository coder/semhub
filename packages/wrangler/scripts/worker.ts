/// <reference types="bun-types" />
import { z } from "zod";

const ActionSchema = z.enum(["dev", "deploy", "delete"]);
const WorkerSchema = z.union([
  z.literal("rate-limiter"),
  z.string().regex(/^workflows\/[a-zA-Z0-9-]+(?:\/[a-zA-Z0-9-]+)*$/, {
    message: "Invalid workflow path format. Example: workflows/sync-repo/cron",
  }),
]);

const ArgsSchema = z.object({
  action: ActionSchema,
  worker: WorkerSchema,
  prod: z.boolean().optional().default(false),
});

try {
  const args = process.argv.slice(2); // remove bun and script path
  const isProd = args.includes("--prod");
  const workerIndex = isProd ? args.indexOf("--prod") + 1 : 1;

  const { action, worker, prod } = ArgsSchema.parse({
    action: args[0],
    worker: args[workerIndex] || undefined,
    prod: isProd,
  });

  const stageFlag = prod ? "--stage prod " : "";
  const envFlag = prod ? "--env prod" : "";
  const configPath = `--config src/${worker}/wrangler.toml`;
  const command = `sst shell ${stageFlag}-- bun scripts/wrangler.ts ${action} ${configPath} ${envFlag}`;

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
      "\nUsage: bun worker.ts <dev|deploy|delete> <rate-limiter|workflows/path/to/worker> [--prod]",
    );
  } else {
    console.error("An unexpected error occurred:", error);
  }
  process.exit(1);
}

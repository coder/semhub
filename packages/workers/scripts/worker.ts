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
});

try {
  const { action, worker } = ArgsSchema.parse({
    action: process.argv[2],
    worker: process.argv[3],
  });

  const command = `sst shell -- bun scripts/wrangler.ts ${action} --config src/wrangler/${worker}/wrangler.toml`;
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
      "\nUsage: bun worker.ts <dev|deploy|delete> <rate-limiter|workflows/path/to/worker>",
    );
  } else {
    console.error("An unexpected error occurred:", error);
  }
  process.exit(1);
}

/// <reference types="bun-types" />
export {};

// enable commands in package.json:
// bun run dev rate-limiter
// bun run deploy workflow

const action = process.argv[2]; // 'dev' or 'deploy'
const worker = process.argv[3]; // 'rate-limiter' or 'workflow'

if (!action || !worker) {
  console.error("Usage: bun worker.ts <dev|deploy> <worker-name>");
  process.exit(1);
}

const command = `sst shell -- bun scripts/wrangler.ts ${action} --config src/wrangler/${worker}/wrangler.toml`;
const proc = Bun.spawn(["sh", "-c", command], {
  stdout: "inherit",
  stderr: "inherit",
});

await proc.exited;

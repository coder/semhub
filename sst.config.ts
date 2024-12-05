/// <reference path="./.sst/platform/config.d.ts" />
import { readdirSync } from "fs";

export default $config({
  app(input) {
    return {
      name: "semhub",
      removal: input?.stage === "prod" ? "retain" : "remove",
      home: "cloudflare",
      providers: {
        supabase: "0.0.3",
        random: true,
        aws: true,
      },
    };
  },
  async run() {
    const outputs = {};
    for (const value of readdirSync("./infra/")) {
      const result = await import("./infra/" + value);
      if (result.outputs) Object.assign(outputs, result.outputs);
    }
    return outputs;
  },
});

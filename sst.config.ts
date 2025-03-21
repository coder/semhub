/// <reference path="./.sst/platform/config.d.ts" />
import { readdirSync } from "fs";

export default $config({
  app(input) {
    return {
      name: "semhub",
      removal: input.stage === "prod" ? "retain" : "remove",
      protected: input.stage === "prod",
      home: "cloudflare",
      providers: {
        random: true,
        aws: {
          profile: "semhub",
          region: input.stage === "prod" ? "us-east-1" : "ap-southeast-1",
        },
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

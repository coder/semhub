import type { WorkflowStepConfig } from "cloudflare:workers";

//* Parameters for database steps config *//

export const getDbStepConfig = (
  type: "short" | "medium" | "long",
): WorkflowStepConfig => ({
  timeout: (() => {
    switch (type) {
      case "short":
        return "10 seconds";
      case "medium":
        return "20 seconds";
      case "long":
        return "120 seconds";
    }
  })(),
  retries: {
    limit: 5,
    backoff: "constant",
    delay: "10 seconds",
  },
});

import type { WorkflowStepConfig } from "cloudflare:workers";

//* Parameters for database steps config *//

// we use this function to solve the problem where the db statement takes too long to complete
// by timing out and retry, we speed up the workflow
export const getStepDuration = (
  type: "short" | "medium" | "long",
): WorkflowStepConfig => ({
  timeout: (() => {
    switch (type) {
      case "short":
        return "20 seconds";
      case "medium":
        return "50 seconds";
      case "long":
        // NB statement timeout in Supabase is 120 seconds by default
        return "200 seconds";
    }
  })(),
  retries: {
    limit: 5,
    backoff: "constant",
    delay: "10 seconds",
  },
});

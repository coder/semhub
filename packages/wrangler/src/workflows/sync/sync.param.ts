import type { WorkflowStepConfig } from "cloudflare:workers";

// See also bodySchema in core/src/github/schema.ts
// where we truncate body size and code blocks

//* Parameters for init workflow *//
export const NUM_CONCURRENT_INITS = 3;
// for GitHub API calls
export const NUM_EMBEDDING_WORKERS = 5; // also corresponds to number of consecutive API calls + upserts before spinning up workers

// duration for parent worker to sleep before checking if workers have finished
export const PARENT_WORKER_SLEEP_DURATION = "30 seconds";

// to avoid issues due to workers return size limit
// used in issue sync too
const DEFAULT_NUM_ISSUES_PER_GITHUB_API_CALL = 100;
export const REDUCE_ISSUES_MAX_ATTEMPTS = 6;
// attempt 0: 100, attempt 1: 50, attempt 2: 25, attempt 3: 12, attempt 4: 6, attempt 5: 3, attempt 6: 2
export const getNumIssues = (attempt: number) =>
  Math.max(
    1,
    Math.floor(DEFAULT_NUM_ISSUES_PER_GITHUB_API_CALL / Math.pow(2, attempt)),
  );
// for reasons I don't fully understand, the actual size of the return value can be
// arbitrarily larger than the response size limit set here (pending Cloudflare support response)
// the problem with a limit that is too high is the return values will be too large to return
// a limit that is too low will (1) result in lower throughput (2) if a single issue is too large, it will fail
export const RESPONSE_SIZE_LIMIT_IN_BYTES = 700000;

//* Parameters for issue embedding workflow *//
export const BATCH_SIZE_PER_EMBEDDING_CHUNK = 25; // clearly linked to DEFAULT_NUM_ISSUES_PER_GITHUB_API_CALL
export const NUM_ISSUES_TO_EMBED_PER_CRON = 100;
// for now, only one cron per issue embedding workflow because
export const NUM_CONCURRENT_EMBEDDING_CRONS = 1;

//* Parameters for issue sync workflow *//
export const NUM_CONCURRENT_ISSUE_CRONS = 1;

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

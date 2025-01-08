// See also bodySchema in core/src/github/schema.ts
// where we truncate body size and code blocks

//* Parameters for init workflow *//
export const NUM_CONCURRENT_INITS = 5;
// for GitHub API calls
export const NUM_EMBEDDING_WORKERS = 3; // also corresponds to number of consecutive API calls + upserts before spinning up workers

// duration for parent worker to sleep before checking if workers have finished
export const PARENT_WORKER_SLEEP_DURATION = "30 seconds";

// to avoid issues due to workers return size limit
// used in issue sync too
const DEFAULT_NUM_ISSUES_PER_GITHUB_API_CALL = 100;
export const REDUCE_ISSUES_MAX_ATTEMPTS = 6;
// attempt 0: 100, attempt 1: 50, attempt 2: 25, attempt 3: 12, attempt 4: 6, attempt 5: 3, attempt 6: 2
export const getNumIssues = (attempt: number, name?: string) => {
  if (name === "golang/go") {
    switch (attempt) {
      case 0:
        return 50;
      case 1:
        return 25;
      case 2:
        return 10;
      case 3:
        return 5;
      case 4:
        return 2;
      case 5:
        return 1;
      case 6:
        return 1;
    }
  }
  return Math.max(
    1,
    Math.floor(DEFAULT_NUM_ISSUES_PER_GITHUB_API_CALL / Math.pow(2, attempt)),
  );
};
// for reasons I don't fully understand, the actual size of the return value can be
// arbitrarily larger than the response size limit set here (pending Cloudflare support response)
// the problem with a limit that is too high is the return values will be too large to return
// a limit that is too low will (1) result in lower throughput (2) if a single issue is too large, it will fail
const DEFAULT_RESPONSE_SIZE_LIMIT_IN_BYTES = 800000;
const SIZE_LIMITS_MAP: Record<string, number> = {
  // special handling for golang, source of many errors
  // will figure out how to properly size return value
  "golang/go": 500000,
};
export const getSizeLimit = (repoName: string) => {
  return SIZE_LIMITS_MAP[repoName] ?? DEFAULT_RESPONSE_SIZE_LIMIT_IN_BYTES;
};

//* Parameters for issue embedding workflow *//
export const BATCH_SIZE_PER_EMBEDDING_CHUNK = 25; // clearly linked to DEFAULT_NUM_ISSUES_PER_GITHUB_API_CALL
export const NUM_ISSUES_TO_EMBED_PER_CRON = 100;
// for now, only one cron per issue embedding workflow because
export const NUM_CONCURRENT_EMBEDDING_CRONS = 2;

//* Parameters for issue sync workflow *//
export const NUM_CONCURRENT_ISSUE_CRONS = 2;

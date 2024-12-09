//* Parameters for init workflow *//
export const NUM_CONCURRENT_INITS = 1;
// for GitHub API calls
export const NUM_EMBEDDING_WORKERS = 5; // also corresponds to number of consecutive API calls + upserts before spinning up workers
export const DEFAULT_NUM_ISSUES_PER_GITHUB_API_CALL = 100;

// duration for parent worker to sleep before checking if workers have finished
export const PARENT_WORKER_SLEEP_DURATION = "30 seconds";

// to avoid issues due to workers return size limit
export const REDUCE_ISSUES_MAX_ATTEMPTS = 6;

//* Parameters for issue embedding workflow *//
export const BATCH_SIZE_PER_EMBEDDING_CHUNK = 25; // clearly linked to DEFAULT_NUM_ISSUES_PER_GITHUB_API_CALL
export const NUM_ISSUES_TO_EMBED_PER_CRON = 100;
// for now, only one cron per issue embedding workflow because
export const NUM_CONCURRENT_EMBEDDING_CRONS = 1;

//* Parameters for issue sync workflow *//
export const NUM_CONCURRENT_ISSUE_CRONS = 1;

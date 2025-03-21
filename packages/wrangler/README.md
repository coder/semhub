# Scalably sync GitHub issues and create embeddings

## Requirements and constraints

### Business logic

When initializing a repo, we need to:

- Call GitHub API to retrieve issues (and related data like comments, labels etc.) Need to Support arbitrarily large repos (upper bound: VSCode has 200k issues).
- Call OpenAI API to create embeddings for all issues, before making the repo searchable to users
- Complete this in a reasonable time (for big repos, a few hours should be OK). Back of envelop calculation for what is theoretically possible: let's say 1500 rpm (half of overall 3000 rpm limit) made to embedding API, then 200k issues / 1500 rpm = 133 minutes, which is slightly more than two hours or so.
- When multiple big repos are initialized, I think it's a better user experience for FIFO, i.e. process them one by one and let users know we're working on it. (Stretch goal: give a time estimate for the users to see in the future...)
- While it is important to have repos initialize quickly, it would be bad if initialization hogs up all the available API rate limits. Specifically, we need to use the embedding API to support actual searches by users.

When running a cron job to bring a repo up to date, we need to:

- Similarly call GitHub API to retrieve issues and call embedding API to update embeddings. These should be much smaller in scale compared to initialization. This is likely to consist of a few issues spread across many repositories.
- We need the repos to be generally up-to-date, so we set the cron job to run every 10 minutes. If a cron job doesn't complete in 10 minutes, the next cron job should not duplicate the work of the previous one and both should run to completion.

In terms of observability, I want to be able to see:

- What are the repos that are queued to initialize, currently being initialized, or have been initialized (and the time when it completed)
- What are the repos that are currently being synced or queued to sync by a cron job, and, for a given repo, when the last sync completed

### GitHub-related

- Maximum number of items retrieved per GraphQL query: 100
- We are using GitHub's GraphQL API to retrieve issues because it allows us to, in a single API call, also retrieve related data (comments, labels etc.). Ordering these issues by `updated_at` seems sensible because `updated_at` increases monotonically, so by doing upsert we always get the latest version of an issue.
- In general, because we can specify the page size and retrieve a lot of issues at once, GitHub's API is not a bottleneck for the overall system.

### OpenAI-related

- Not super sure, but I assume we are on the 3000 rpm plan. This is something I should clarify.
- OpenAI actually offers a batch API endpoint, which allows for asynchronous processing within 24 hours. However, it feels like this is too slow (if I'm a user and I have to wait 24 hours before my issues become searchable, that's not a good user experience).
- In my tests involving small repos (~5k issues), most of the time is spent on calling the OpenAI embedding API, i.e. this is the bottleneck.

### Cloudflare-related

The relevant Workers-related limitations (per invocation) are:

- 1000 subrequests (i.e. calling external APIs or to Cloudflare services, including via service bindings)
- 6 simultaneous outgoing connections
- 1 MiB limit for params passed through JavaScript RPC and returned in the response.

I think we should use Cloudflare Workflows to orchestrate both the initialization and the cron job. The relevant limitations are:

- 30s of active CPU time
- Max persisted state per step: 1MiB (in practice, has run into this limit quite a lot)
- Max state persisted per Workflow: 1GB
- Max steps per Workflow: 512 (easy to get around this limit by self-invoking)
- Concurrent Workflow instances: 100

Some patterns to consider:

- **Chunking**: break down work into smaller chunks that could be processed in parallel or sequentially.
- **Manager-worker**: use a master Workflow to manage other workflows. This could be useful for getting around the 1000 subrequests limit, but should be used with the next pattern to avoid inflating the number of steps.
- **Recursion/self-invoking**: the Workflow checks whether there's work to be done, does a chunk of it, and then self-invokes with the remaining work. When there is no more work to be done, the Workflow marks the task as complete and terminates.

## Proposed design

### Repo initialization

A repo starts its life with `initStatus` as `ready` and will always be initialized by a long-running workflow, which can be triggered in two ways. First, the server can create the repo and invoke the workflow to initialize it. Second, there will be a regular cron job that tuns to see if there are any repos to be initialized, which ensures that there will at most be a short interval before the next repo is initialized. Collectively, this ensures that there is at most one repo being initialized at any one time. To be exact the server/cron will:

- if there is already a repo being initialized or if there are no repos to be initialized, the cron will return early.
- otherwise, in the same transaction, it will invoke the workflow and set the `initStatus` to `in_progress`

It is important to write the workflow in a way that it can be self-invoked recursively until all the relevant work is complete. Specifically:

- This workflow will check if this repo needs to be initialized. The conditions for this are: (1) the repo's `initStatus` is `in_progress` (set previously by server/cron), else return early; (2) when we call GitHub API with repo's `issueLastUpdatedAt` (which could be null), if there are no more additional issues, it will upsert the current issues and return early (this is because the `since` parameter in the GitHub API is inclusive, so if we use the current `issueLastUpdatedAt`, we will always get at least _that_ issue — if I increase the `since` parameter, there is a small risk of missing out on issues and the zod validation would fail).
- This workflow's termination condition is: (1) the repo has issues; (2) all these issues have embeddings; (3) when the GitHub API is called with the repo's `issueLastUpdatedAt`, it returns no more issues.
- When workflow terminates, it will set the `initStatus` to `completed` and update `initializedAt`.
- If termination condition is not met, it will do one unit of work and then self-invoke.
- If it runs into an error, it will set `initStatus` to `error` before terminating. Ideally, it should log/send an error when this happens. (TODO) This error state prevents the initialization queue from being clogged up.
- One unit of work is: (1) call GitHub API to retrieve and upsert issues (with associated data like comments, labels etc.); (2) call OpenAI API to create embeddings and upsert them. While we can only call the GitHub API with 100 issues per call, in one workflow, we can experiment with calling the GitHub API multiple times and tuning the concurrency of the OpenAI API calls to speed things up.

Some additional notes:

- Only when `initStatus` is `complete` do we make the repo searchable for users.
- We will use a rate limiter to ensure that there will always be available quota to support search (which requires calling the embedding API too). More generally, we will have three separate rate limiters to ensure that initialization and syncing do not starve the search. (UPDATE: I tried to use a rate limiter to allocate API calls rate limit this way, but ran into the issue that calls to the rate limiter itself counts towards the number of subrequests a Cloudflare Worker can make. As such, I ended up removing the rate limiter for now — we could consider using different API keys if this becomes a problem.)

### Repo sync cron

Keeping the repo in sync will be entirely initiated by the sync cron. Actually, there are two conceptually distinct properties to keep in sync:

1. The issues in a repository. It makes sense to think of these as related to a repo because that's how we have to query the GitHub API.
2. The embeddings that are not in sync with the issues. We know this by checking the diff between the `issueUpdatedAt` and the `embeddingCreatedAt` and it's better to sync them separately from keeping the repo in sync. Ideally, we want to incorporate more things into the embeddings (e.g. summarise the body, summarise the comments, tallying the reactions etc.)

For the first property, because we have no way to know if they are in sync, we will simply have to query the API regularly to keep in sync. It is important that the time it takes for this cron to complete is less than the interval at which the cron runs (which will be 10 minutes for now). For simplicity, we will invoke a workflow with the repoIds, which will loop through every repo, call the GitHub API, and upsert issues received.

To avoid race conditions:

- At the beginning, we will mark `syncStatus` to `queued` for all repos caught by the cron (which should exclude repos that have not been initialized or are still being synced by the previous cron job).
- We will work on one repo at a time and that repo will be the only one with `syncStatus` set to `in_progress`. This is because the bottleneck is really the GitHub API and there is no point in parallelizing that. When that particular repo is done syncing, it will set the `syncStatus` to `ready` and update `lastSyncedAt`.
- If the workflow runs into an error, it will set that particular repo to `error` and restores the status of the other unprocessed repos (to be picked up in the subsequent cron).

If the cron takes longer than the interval to run, at the very least, jobs that are `queued` and `in_progress` will be skipped and that new cron will take a shorter time to complete.

For the second property, we will sync them at the issues level. Specifically, the cron will trigger a workflow that can self-invoke recursively until all the relevant issues are in sync. This cron job will run every 15 minutes so as to be staggered from the first cron job.

- When the workflow starts, it queries for out-of-sync issues that are not being synced, sort ascending by `issueUpdatedAt`. If there are no such issues, the workflow will terminate.
- For the issues selected (bounded by a fixed `limit`), it will set `embeddingSyncStatus` to `in_progress` and call the OpenAI API to create embeddings.
- After the embeddings are created, it will update the embeddings and set `embeddingSyncStatus` to `completed`.
- The workflow will then self-invoke with the remaining issues.
- It is good if the workflow (collectively) terminates before the next cron job is run, but the hope is (1) with the `embeddingSyncStatus` flag, the next cron job will not do duplicate work; (2) with two cron jobs running at the same time, all the issues will be processed quickly.

## Summary

There will be three cron jobs and three workflows:

1. A cron to ensure that there will be at most 5-minute delay before the next repo is initialized and `init.workflow.ts` to actually initialize the repo recursively. Repos are initialized one-at-a-time. `init.workflow.ts` actually calls `embedding.workflow.ts` to create embeddings (because these are subrequests-intensive).
2. A cron to keep the repos of issues in sync by invoking `issue.workflow.ts`, which loops through all repos one-at-a-time.
3. A cron to keep the embeddings of issues in sync by invoking `embedding.workflow.ts`, which recursively processes out-of-sync issues until they are all in sync.

## For future extensions

- Rate limiting
- Test that increased concurrency (see `sync.param.ts`) actually works as intended

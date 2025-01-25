import { createFileRoute } from "@tanstack/react-router";

import { ApiError } from "@/lib/api/client";
import { getRepoStatusQueryOptions, useRepoStatus } from "@/lib/hooks/useRepo";
import { Skeleton } from "@/components/ui/skeleton";
import { EmbedBadgePopover } from "@/components/embed/EmbedBadgePopover";
import { RepoSearchBar } from "@/components/search/RepoSearchBar";
import { RepoStatusPopover } from "@/components/search/RepoStatusPopover";

export const Route = createFileRoute("/r/$owner/$repo")({
  loader: ({ context, params: { owner, repo } }) =>
    context.queryClient.ensureQueryData(getRepoStatusQueryOptions(owner, repo)),
  component: () => <RepoSearch />,
  pendingComponent: () => <RepoSearchSkeleton />,
  errorComponent: ({ error }) => {
    if (error instanceof ApiError && error.code === 404) {
      return <NotFoundView />;
    }
    return <ErrorView />;
  },
});

function RepoSearchSkeleton() {
  return (
    <div className="relative flex w-full justify-center pt-28">
      <div className="w-full max-w-screen-xl px-4">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-2 flex items-center gap-2">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-8 w-64" />
          </div>
          <Skeleton className="mb-8 h-6 w-96" />
          <div className="mx-auto w-full max-w-2xl">
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

function RepoSearch() {
  let { owner, repo } = Route.useParams();
  const { data: repoStatus } = useRepoStatus(owner, repo);

  const {
    avatarUrl,
    issuesLastUpdatedAt,
    lastSyncedAt,
    initStatus,
    syncStatus,
  } = repoStatus;
  // overwrite with returned values, which are properly cased
  owner = repoStatus.repoOwner;
  repo = repoStatus.repoName;
  const NoIssuesView = () => (
    <div className="flex size-full items-center justify-center p-2">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <p className="font-mono text-4xl font-bold">Repo has no issues</p>
          <p className="font-mono text-lg text-muted-foreground">
            <RepoLink owner={owner} repo={repo} />
          </p>
        </div>

        <div className="flex flex-col gap-2 text-muted-foreground">
          <p className="text-lg">This repo does not have any issues.</p>
          <p className="text-lg">
            SemHub currently only supports issues, not pull requests.
          </p>
        </div>
      </div>
    </div>
  );

  const QueuedView = ({ queuePosition }: { queuePosition: number }) => (
    <div className="flex size-full items-center justify-center p-2">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <p className="font-mono text-4xl font-bold">Repo Queued</p>
          <p className="font-mono text-lg text-muted-foreground">
            <RepoLink owner={owner} repo={repo} />
          </p>
        </div>

        <div className="flex flex-col gap-2 text-muted-foreground">
          <p className="text-lg">
            This repo is queued for initialization.{" "}
            {queuePosition === 1 || queuePosition === 0 ? (
              <>
                There is{" "}
                <span className="font-mono font-bold underline">1</span> repo
                ahead of it in the queue.
              </>
            ) : (
              <>
                There are{" "}
                <span className="font-mono font-bold underline">
                  {queuePosition}
                </span>{" "}
                repos ahead of it in the queue.
              </>
            )}
          </p>
          <p className="text-lg">
            We&apos;ll start processing it shortly. Please check back in a few
            moments.
          </p>
        </div>
      </div>
    </div>
  );

  const InitializingView = ({
    syncedIssuesCount,
    allIssuesCount,
  }: {
    syncedIssuesCount: number;
    allIssuesCount: number;
  }) => {
    const progress = Math.round((syncedIssuesCount / allIssuesCount) * 100);

    return (
      <div className="flex size-full items-center justify-center p-2">
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <p className="font-mono text-4xl font-bold">Initializing Repo...</p>
            <p className="font-mono text-lg text-muted-foreground">
              <RepoLink owner={owner} repo={repo} />
            </p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex h-8 w-96 gap-1 overflow-hidden rounded-lg border-2 border-primary p-1">
              {[...Array(20)].map((_, i) => {
                const segmentProgress = (i + 1) * 5; // Each block represents 5%
                const isFilled = progress >= segmentProgress;
                const isCurrentBlock =
                  progress >= segmentProgress - 5 && progress < segmentProgress;

                return (
                  <div
                    key={i}
                    className={`h-full flex-1 rounded-sm transition-colors ${
                      isFilled
                        ? "bg-primary"
                        : isCurrentBlock
                          ? "animate-cursor-slow bg-primary"
                          : "bg-muted"
                    }`}
                  />
                );
              })}
            </div>
            <p className="font-mono text-sm text-muted-foreground">
              Processed {syncedIssuesCount} of {allIssuesCount} issues (
              {progress}%)<sup>*</sup>
            </p>
            <p className="text-xs italic text-muted-foreground/80">
              *Stats are cached and may be slightly out-of-date
            </p>
          </div>

          <p className="text-sm italic text-muted-foreground">
            Search functionality will be available once initialization is
            complete
          </p>
        </div>
      </div>
    );
  };

  switch (initStatus) {
    // should never be hit, this is for private repos only?
    case "pending":
      return <ErrorView />;
    case "ready": {
      const { repoInitQueuePosition } = repoStatus;
      return <QueuedView queuePosition={repoInitQueuePosition} />;
    }
    case "in_progress": {
      const {
        syncedIssuesCount,
        repoIssueCounts: { allIssuesCount },
      } = repoStatus;
      return (
        <InitializingView
          syncedIssuesCount={syncedIssuesCount}
          allIssuesCount={allIssuesCount}
        />
      );
    }
    case "no_issues":
      return <NoIssuesView />;
    case "error":
      return <ErrorView />;
    case "completed":
      return (
        <div className="relative flex w-full justify-center pt-28">
          <div className="w-full max-w-screen-xl px-4">
            <div className="mb-8 flex flex-col items-center">
              <div className="mb-2 flex items-center gap-2">
                <img
                  src={avatarUrl}
                  alt={`${owner}'s avatar`}
                  className="size-6 translate-y-px rounded-full"
                />
                <h1 className="text-center font-serif text-3xl tracking-tight">
                  <RepoLink owner={owner} repo={repo} />
                </h1>
              </div>
              <h2 className="mb-8 text-center font-serif text-lg italic tracking-tight text-muted-foreground">
                Uncover insights with{" "}
                <span className="text-blue-600 dark:text-blue-500">Sem</span>
                antic search for Git
                <span className="text-orange-500">Hub</span>
              </h2>
              <div className="mx-auto w-full max-w-2xl">
                <RepoSearchBar owner={owner} repo={repo} />
              </div>
            </div>
          </div>
          <div className="fixed bottom-8 right-8 flex items-center gap-2">
            <RepoStatusPopover
              lastSyncedAt={lastSyncedAt}
              issuesLastUpdatedAt={issuesLastUpdatedAt}
              syncStatus={syncStatus}
              initStatus={initStatus}
            />
            <EmbedBadgePopover owner={owner} repo={repo} />
          </div>
        </div>
      );
  }
  initStatus satisfies never;
}

// Shared component for repo links
function RepoLink({ owner, repo }: { owner: string; repo: string }) {
  return (
    <a
      href={`https://github.com/${owner}/${repo}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex hover:underline hover:opacity-80"
    >
      <code className="rounded bg-muted px-1.5 py-0.5">
        {owner}/{repo}
      </code>
    </a>
  );
}

// Error views
function NotFoundView() {
  const { owner, repo } = Route.useParams();
  return (
    <div className="flex size-full items-center justify-center p-2">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <p className="font-mono text-4xl font-bold">Repo Not Found</p>
          <p className="font-mono text-lg text-muted-foreground">
            <RepoLink owner={owner} repo={repo} />
          </p>
        </div>
        <div className="flex flex-col gap-2 text-muted-foreground">
          <p className="text-lg">
            Is there a typo? This repo could not be found.
          </p>
          <p className="text-lg">
            If this is a private repo, you must log in to search it.
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorView() {
  return (
    <div className="flex size-full items-center justify-center p-2">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <p className="font-mono text-4xl font-bold">Unexpected Error</p>
          <p className="font-mono text-lg text-muted-foreground">
            System Error
          </p>
        </div>
        <div className="flex flex-col gap-2 text-muted-foreground">
          <p className="text-lg">We&apos;ve encountered an unexpected error.</p>
          <p className="text-lg">
            If this error persists for an extended period, please contact us for
            assistance.
          </p>
        </div>
      </div>
    </div>
  );
}

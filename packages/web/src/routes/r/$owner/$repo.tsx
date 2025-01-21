import { createFileRoute, notFound } from "@tanstack/react-router";

import { ApiError } from "@/lib/api/client";
import { getRepoStatus } from "@/lib/api/repo";
import { EmbedBadgePopover } from "@/components/search/EmbedBadgePopover";
import { RepoSearchBar } from "@/components/search/RepoSearchBar";
import { RepoStatusTooltip } from "@/components/search/RepoStatusTooltip";

export const Route = createFileRoute("/r/$owner/$repo")({
  loader: async ({ params: { owner, repo } }) => {
    try {
      const data = await getRepoStatus(owner, repo);
      return data;
    } catch (error) {
      if (error instanceof ApiError && error.code === 404) {
        throw notFound();
      }
      throw error;
    }
  },
  // pendingComponent: () => <RepoSearchSkeleton />,
  component: () => <RepoSearch />,
  notFoundComponent: () => <NotFoundView />,
  errorComponent: () => <ErrorView />,
});

// function RepoSearchSkeleton() {
//   return (
//     <div className="relative flex w-full justify-center pt-28">
//       <div className="w-full max-w-screen-xl px-4">
//         <div className="mb-8 flex flex-col items-center">
//           <div className="mb-2 flex items-center gap-2">
//             <Skeleton className="size-6 rounded-full" />
//             <Skeleton className="h-8 w-64" />
//           </div>
//           <Skeleton className="mb-8 h-6 w-96" />
//           <div className="mx-auto w-full max-w-2xl">
//             <Skeleton className="h-10 w-full rounded-lg" />
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

function RepoSearch() {
  const { owner, repo } = Route.useParams();
  const {
    repoIssueCounts: { allIssuesCount },
    repoStatus,
    syncedIssuesCount,
  } = Route.useLoaderData();

  const {
    avatarUrl,
    issuesLastUpdatedAt,
    lastSyncedAt,
    initStatus,
    syncStatus,
  } = repoStatus;

  const NoIssuesView = () => (
    <div className="flex size-full items-center justify-center p-2 text-2xl">
      <div className="flex flex-col items-center gap-4">
        <p className="text-4xl font-bold">Repository has no issues</p>
        <p className="text-center text-lg text-muted-foreground">
          The repo <RepoLink owner={owner} repo={repo} /> does not have any
          issues.
        </p>
        <p className="text-center text-lg text-muted-foreground">
          SemHub currently only supports issues, not pull requests.
        </p>
      </div>
    </div>
  );

  const InitializingView = () => (
    <div className="flex size-full items-center justify-center p-2 text-2xl">
      <div className="flex flex-col items-center gap-4">
        <p className="text-4xl font-bold">Initializing repository...</p>
        <p className="text-center text-lg text-muted-foreground">
          <RepoLink owner={owner} repo={repo} /> is being initialized.
        </p>
        <p className="text-center text-lg text-muted-foreground">
          Please come back again later when the repo has been initialized.
        </p>
      </div>
    </div>
  );

  switch (initStatus) {
    // should never be hit, this is for private repos only?
    case "pending":
      return <ErrorView />;
    case "ready":
    case "in_progress":
      return <InitializingView />;
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
            <RepoStatusTooltip
              lastSyncedAt={lastSyncedAt}
              issuesLastUpdatedAt={issuesLastUpdatedAt}
              syncStatus={syncStatus}
              initStatus={initStatus}
            />
            <EmbedBadgePopover owner={owner} repo={repo} />
          </div>
        </div>
      );
    default:
      initStatus satisfies never;
      return <NotFoundView />;
  }
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
    <div className="flex size-full items-center justify-center p-2 text-2xl">
      <div className="flex flex-col items-center gap-4">
        <p className="text-4xl font-bold">Repository Not Found</p>
        <p className="text-center text-lg text-muted-foreground">
          The repo <RepoLink owner={owner} repo={repo} /> could not be found.
        </p>
        <p className="text-center text-lg text-muted-foreground">
          Please ensure this repo exists on GitHub.
        </p>
      </div>
    </div>
  );
}

function ErrorView() {
  return (
    <div className="flex size-full items-center justify-center p-2 text-2xl">
      <div className="flex flex-col items-center gap-4">
        <p className="text-4xl font-bold">Unexpected error</p>
        <p className="text-center text-lg text-muted-foreground">
          We&apos;ve encountered an unexpected error. If this error persists for
          an extended period, please contact us for assistance.
        </p>
      </div>
    </div>
  );
}

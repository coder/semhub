import { createFileRoute } from "@tanstack/react-router";

import { useRepoStatus } from "@/lib/hooks/useRepo";
import {
  EmbedBadgePopover,
  RepoStatusTooltip,
} from "@/components/search/repo/components";
import { RepoSearchBar } from "@/components/search/RepoSearchBar";

export const Route = createFileRoute("/r/$owner/$repo")({
  component: RepoSearch,
});

function RepoSearch() {
  const { owner, repo } = Route.useParams();
  const { data: repoStatus } = useRepoStatus(owner, repo);

  const NotFoundView = () => (
    <div className="relative flex w-full flex-col items-center justify-center pt-28">
      <h1 className="mb-4 text-3xl font-bold">Repository Not Found</h1>
      <p className="text-muted-foreground">
        The repository{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">
          {owner}/{repo}
        </code>{" "}
        could not be found.
      </p>
      <p className="mt-2 text-muted-foreground">
        Please ensure this repository has been added to Semhub.
      </p>
    </div>
  );

  if (!repoStatus) {
    return <NotFoundView />;
  }

  const {
    avatarUrl,
    issuesLastUpdatedAt,
    lastSyncedAt,
    initStatus,
    syncStatus,
  } = repoStatus;

  const InitializingView = () => (
    <div className="relative flex w-full flex-col items-center justify-center pt-28">
      <h1 className="mb-4 text-3xl font-bold">Repository Initializing</h1>
      <p className="text-muted-foreground">
        The repository{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">
          {owner}/{repo}
        </code>{" "}
        is being initialized.
      </p>
      <p className="mt-2 text-muted-foreground">
        Please come back again later when the repository has been initialized.
      </p>
    </div>
  );

  switch (initStatus) {
    case "pending":
      return <NotFoundView />;
    case "ready":
    case "in_progress":
      return <InitializingView />;
    case "error":
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
                  <a
                    href={`https://github.com/${owner}/${repo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center"
                  >
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xl hover:bg-muted/80">
                      {owner}/{repo}
                    </code>
                  </a>
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
      return <NotFoundView />;
  }
}

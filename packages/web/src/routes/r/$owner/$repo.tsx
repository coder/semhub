import { createFileRoute } from "@tanstack/react-router";

import { useRepoStatus } from "@/lib/hooks/useRepo";
import { RepoSearchBar } from "@/components/search/RepoSearchBar";

export const Route = createFileRoute("/r/$owner/$repo")({
  component: RepoSearch,
});

function RepoSearch() {
  const { owner, repo } = Route.useParams();

  const { data: repoStatus } = useRepoStatus(owner, repo);

  if (!repoStatus) {
    return (
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
  }

  return (
    <div className="relative flex w-full justify-center pt-28">
      <div className="w-full max-w-screen-xl px-4">
        <h1 className="mb-6 text-center font-serif text-3xl tracking-tight">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xl">
            {owner}/{repo}
          </code>
        </h1>
        <div className="mx-auto max-w-2xl">
          <RepoSearchBar owner={owner} repo={repo} />
        </div>
      </div>
    </div>
  );
}

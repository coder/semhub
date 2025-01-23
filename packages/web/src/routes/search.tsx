import {
  infiniteQueryOptions,
  useSuspenseInfiniteQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { useMemo } from "react";

import { extractOwnerAndRepo } from "@/core/semsearch/util";
import { publicSearchIssues } from "@/lib/api/search";
import { useRepoStatus } from "@/lib/hooks/useRepoStatus";
import { queryKeys } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RepoPreviewSkeleton } from "@/components/repos/RepoPreview";
import {
  ErrorMessage,
  InitializingMessage,
  NoMatchesMessage,
  NotFoundMessage,
  OnGithubMessage,
} from "@/components/repos/RepoStatusMessages";
import { IssueCard } from "@/components/search/IssueCard";
import { ResultsSearchBar } from "@/components/search/PublicSearchBars";
import {
  publicSearchSchema,
  type PublicSearchSchema,
} from "@/workers/server/router/schema/search.schema";

const issuesInfiniteQueryOptions = ({
  q,
  lucky,
}: Omit<PublicSearchSchema, "page">) => {
  return infiniteQueryOptions({
    queryKey: queryKeys.issues.search.public({ q, lucky }),
    queryFn: ({ pageParam = 1 }) =>
      publicSearchIssues({ query: q, pageParam, lucky }),
    initialPageParam: 1,
    staleTime: Infinity, // only re-fetch when query changes
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.pagination.totalPages <= lastPageParam) {
        return undefined;
      }
      return lastPageParam + 1;
    },
  });
};

export const Route = createFileRoute("/search")({
  validateSearch: publicSearchSchema,
  loaderDeps: ({ search: { q, lucky } }) => ({ q, lucky }),
  component: () => <Search />,
  pendingComponent: () => <SearchSkeleton />,
  loader: ({ context, deps: { q, lucky } }) => {
    context.queryClient.ensureInfiniteQueryData(
      issuesInfiniteQueryOptions({ q, lucky }),
    );
  },
});

function NothingMatched({ query }: { query: string }) {
  const extracted = useMemo(() => extractOwnerAndRepo(query), [query]);

  const { repoStatus, error, preview, isLoading } = useRepoStatus(
    extracted?.owner ?? null,
    extracted?.repo ?? null,
  );

  if (!extracted) {
    return <NoMatchesMessage />;
  }
  if (isLoading) {
    return <RepoPreviewSkeleton />;
  }

  switch (repoStatus) {
    // still loading
    case null:
      return <RepoPreviewSkeleton />;
    case "not_found":
      return <NotFoundMessage />;
    case "loaded":
      return <NoMatchesMessage />;
    case "initializing":
      return (
        <InitializingMessage owner={extracted.owner} repo={extracted.repo} />
      );
    case "error":
      return <ErrorMessage owner={extracted.owner} repo={extracted.repo} />;
    case "on_github":
      return <OnGithubMessage error={error} preview={preview} />;
    default: {
      repoStatus satisfies never;
      return null;
    }
  }
}

function IssuesSkeleton() {
  return (
    <div className="divide-y rounded-lg border bg-background">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="p-4 sm:p-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-full" />
              <div className="flex-1">
                <Skeleton className="mb-2 h-4 w-32" />
                <Skeleton className="h-6 w-3/4" />
              </div>
            </div>
            <Skeleton className="ml-6 h-4 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchLayout({ children }: { children: React.ReactNode }) {
  const { q } = Route.useSearch();
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4">
      <ResultsSearchBar query={q} />
      {children}
    </div>
  );
}

function Search() {
  const { q, lucky } = Route.useSearch();
  const { data, isFetching, fetchNextPage, hasNextPage } =
    useSuspenseInfiniteQuery(issuesInfiniteQueryOptions({ q, lucky }));

  const redirectUrl = lucky === "y" && data?.pages[0]?.data[0]?.issueUrl;
  if (redirectUrl) {
    window.location.replace(redirectUrl);
    return (
      <div className="mx-auto mt-8 flex flex-col items-center justify-center">
        <Loader2Icon className="animate-spin" />
        <p className="mt-2 text-sm text-muted-foreground">Getting there...</p>
      </div>
    );
  }

  return (
    <SearchLayout>
      {data?.pages.length === 0 || data?.pages[0]?.data.length === 0 ? (
        <NothingMatched query={q} />
      ) : (
        <>
          <div className="divide-y rounded-lg border">
            {data?.pages.map((page) =>
              page.data.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              )),
            )}
          </div>
          <div className="flex justify-center py-4">
            <Button
              onClick={() => fetchNextPage()}
              disabled={!hasNextPage || isFetching}
              variant="outline"
            >
              {isFetching
                ? "Loading more..."
                : hasNextPage
                  ? "Load more issues"
                  : "No more issues"}
            </Button>
          </div>
        </>
      )}
    </SearchLayout>
  );
}

function SearchSkeleton() {
  return (
    <SearchLayout>
      <IssuesSkeleton />
    </SearchLayout>
  );
}

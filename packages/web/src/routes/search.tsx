import {
  infiniteQueryOptions,
  useQuery,
  useSuspenseInfiniteQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { repoSchema } from "@/core/github/schema.rest";
import { extractOwnerAndRepo } from "@/core/semsearch/util";
import { getRepo } from "@/lib/api/repo";
import { publicSearchIssues } from "@/lib/api/search";
import { queryKeys } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RepoPreview,
  RepoPreviewSkeleton,
  type RepoPreviewProps,
} from "@/components/repos/RepoPreview";
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
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<RepoPreviewProps | null>(null);
  const [repoStatus, setRepoStatus] = useState<
    "not_found" | "initializing" | "error" | "loaded" | "on_github" | null
  >(null);
  // important to prevent infinite re-renders
  const extracted = useMemo(() => extractOwnerAndRepo(query), [query]);

  const { data: repoPreviewData, isLoading } = useQuery({
    queryKey: queryKeys.repos.get(extracted!.owner, extracted!.repo),
    queryFn: async () => {
      if (!extracted) {
        return null;
      }
      const { data: repoResponse } = await getRepo(
        extracted.owner,
        extracted.repo,
      );
      if (!repoResponse.exists) {
        setRepoStatus("not_found");
        return null;
      }
      if (repoResponse.hasLoaded) {
        const { initStatus } = repoResponse;
        switch (initStatus) {
          case "pending": {
            // should never happen
            setRepoStatus("not_found");
            return null;
          }
          case "completed":
            setRepoStatus("loaded");
            return null;
          case "in_progress":
          case "ready":
            setRepoStatus("initializing");
            return null;
          case "error":
          case "no_issues":
            setRepoStatus("error");
            return null;
          default:
            initStatus satisfies never;
        }
      } else {
        setRepoStatus("on_github");
      }
      const { owner, repo } = extracted;
      const githubResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
      );
      if (!githubResponse.ok) {
        setError(
          githubResponse.status === 404
            ? "This repo does not exist on GitHub"
            : githubResponse.status === 403
              ? "This repo is on GitHub but rate limit is reached"
              : "Unknown error: failed to fetch repository",
        );
        return null;
      }
      const data = repoSchema.parse(await githubResponse.json());
      return data;
    },
    enabled: !!extracted,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (extracted && !isLoading && repoPreviewData) {
      setPreview({
        name: repoPreviewData.name,
        description: repoPreviewData.description,
        owner: {
          login: repoPreviewData.owner.login,
          avatarUrl: repoPreviewData.owner.avatar_url,
        },
        private: repoPreviewData.private,
        stargazersCount: repoPreviewData.stargazers_count,
      });
    }
  }, [extracted, isLoading, repoPreviewData]);
  switch (repoStatus) {
    // still loading
    case null:
      return <RepoPreviewSkeleton />;
    case "not_found":
      return (
        <div className="rounded-lg border bg-background p-4 text-mobile-base sm:p-6 sm:text-base">
          This repo does not exist. Is it spelled correctly?
        </div>
      );
    case "loaded":
      return (
        <div className="rounded-lg border bg-background p-4 text-mobile-base sm:p-6 sm:text-base">
          No issues matched your search
        </div>
      );
    case "initializing": {
      return (
        <div className="rounded-lg border bg-background p-4 text-mobile-base sm:p-6 sm:text-base">
          This repository is being initialized. For more information,{" "}
          <Link
            to="/r/$owner/$repo"
            params={{ owner: extracted!.owner, repo: extracted!.repo }}
          >
            click here
          </Link>
          .
        </div>
      );
    }
    case "error":
      return (
        <div className="rounded-lg border bg-background p-4 text-mobile-base sm:p-6 sm:text-base">
          This repository is in an error state. For more information,{" "}
          <Link
            to="/r/$owner/$repo"
            params={{ owner: extracted!.owner, repo: extracted!.repo }}
            className="text-primary underline"
          >
            click here
          </Link>
          .
        </div>
      );
    case "on_github":
      return (
        <div className="rounded-lg border bg-background p-4 text-mobile-base sm:p-6 sm:text-base">
          <div className="space-y-4">
            <p>No issues matched your search</p>
            {isLoading && <RepoPreviewSkeleton />}
            {error && (
              <>
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircleIcon className="size-4" />
                  <span>{error}</span>
                </div>
                {error.includes("rate limit") && (
                  <div className="flex justify-center">
                    <Button asChild variant="default">
                      <Link
                        to="/r/$owner/$repo"
                        params={{
                          owner: extracted!.owner,
                          repo: extracted!.repo,
                        }}
                      >
                        Load repo in SemHub
                      </Link>
                    </Button>
                  </div>
                )}
              </>
            )}
            {!isLoading && preview && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  It looks like you&apos;re searching for this repository.
                </p>
                <RepoPreview
                  name={preview.name}
                  description={preview.description}
                  owner={preview.owner}
                  private={preview.private}
                  stargazersCount={preview.stargazersCount}
                />
                <div className="flex justify-center">
                  <Button asChild variant="default">
                    <Link
                      to="/r/$owner/$repo"
                      params={{
                        owner: preview.owner.login,
                        repo: preview.name,
                      }}
                    >
                      Load repo in SemHub
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
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

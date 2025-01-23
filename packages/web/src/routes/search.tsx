import {
  infiniteQueryOptions,
  useQuery,
  useSuspenseInfiniteQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import { repoSchema } from "@/core/github/schema.rest";
import { modifyUserQuery, parseSearchQuery } from "@/core/semsearch/util";
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
import { validateAndExtractGithubOwnerAndRepo } from "@/components/repos/subscribe";
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

function NothingMatchedStatic() {}

function NothingMatched({ query }: { query: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<RepoPreviewProps | null>(null);
  const repoInfo = validateAndExtractGithubOwnerAndRepo(query);

  const modifiedQuery = modifyUserQuery(query);
  const { ownerQueries, repoQueries } = parseSearchQuery(modifiedQuery);
  const owner = ownerQueries[0];
  const repo = repoQueries[0];
  if (!owner || !repo) {
    return null;
  }

  const { data: repoData, isLoading: isLoadingRepo } = useQuery({
    queryKey: queryKeys.repos.get(owner, repo),
    queryFn: () => getRepo(owner, repo),
    enabled: !!owner && !!repo,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const fetchPreview = async (owner: string, repo: string) => {
    try {
      setIsLoadingPreview(true);
      const githubResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
      );
      if (!githubResponse.ok) {
        throw new Error(
          githubResponse.status === 404
            ? "Repository not found"
            : githubResponse.status === 403
              ? "Rate limit exceeded. Please try again later."
              : "Failed to fetch repository",
        );
      }
      const data = repoSchema.parse(await githubResponse.json());
      setPreview({
        name: data.name,
        description: data.description,
        owner: {
          login: data.owner.login,
          avatarUrl: data.owner.avatar_url,
        },
        private: data.private,
        stargazersCount: data.stargazers_count,
      });
      setError(null);
    } catch (error) {
      console.error("Preview fetch error:", error);
      setError(
        error instanceof Error ? error.message : "Failed to fetch repository",
      );
      setPreview(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (repoData?.data?.hasLoaded === false && repoInfo) {
      void fetchPreview(repoInfo.owner, repoInfo.repo);
    }
  }, [repoData?.data?.hasLoaded, repoInfo]);

  const isLoading = isLoadingRepo || isLoadingPreview;

  return (
    <div className="rounded-lg border bg-background p-4 text-mobile-base sm:p-6 sm:text-base">
      <div className="space-y-4">
        <p>No issues matched your search</p>
        {isLoading && <RepoPreviewSkeleton />}
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircleIcon className="size-4" />
            <span>{error}</span>
          </div>
        )}
        {preview && !isLoading && repoData?.data?.hasLoaded === false && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              However, it looks like you&apos;re searching for a repository.
              Would you like to:
            </p>
            <RepoPreview
              name={preview.name}
              description={preview.description}
              owner={preview.owner}
              private={preview.private}
              stargazersCount={preview.stargazersCount}
            />
            <div className="flex justify-end">
              <Button asChild variant="default">
                <a href={`/r/${preview.owner.login}/${preview.name}`}>
                  Go to Repository
                </a>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
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

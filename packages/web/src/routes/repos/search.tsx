import {
  infiniteQueryOptions,
  useSuspenseInfiniteQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { meSearchIssues } from "@/lib/api/search";
import { queryKeys } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IssueCard } from "@/components/IssueCard";
import { MyReposResultsSearchBar } from "@/components/search/MeSearchBars";
import {
  meSearchSchema,
  type MeSearchSchema,
} from "@/workers/server/router/schema/search.schema";

const issuesInfiniteQueryOptions = ({ q, page }: MeSearchSchema) => {
  return infiniteQueryOptions({
    queryKey: queryKeys.issues.search.me({ q, page }),
    queryFn: () => meSearchIssues({ query: q, pageParam: page }),
    initialPageParam: 1,
    staleTime: Infinity,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.pagination.totalPages <= lastPageParam) {
        return undefined;
      }
      return lastPageParam + 1;
    },
  });
};

export const Route = createFileRoute("/repos/search")({
  validateSearch: meSearchSchema,
  loaderDeps: ({ search: { q, page } }) => ({ q, page }),
  component: () => <ReposSearch />,
  pendingComponent: () => <SearchSkeleton />,
  loader: ({ context, deps: { page, q } }) => {
    context.queryClient.ensureInfiniteQueryData(
      issuesInfiniteQueryOptions({ q, page }),
    );
  },
});

function NothingMatched() {
  return (
    <div className="rounded-lg border bg-background p-4 text-mobile-base sm:p-6 sm:text-base">
      No issues matched your search
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
      <MyReposResultsSearchBar query={q} />
      {children}
    </div>
  );
}

function ReposSearch() {
  const { q, page } = Route.useSearch();
  const { data, isFetching, fetchNextPage, hasNextPage } =
    useSuspenseInfiniteQuery(issuesInfiniteQueryOptions({ q, page }));

  return (
    <SearchLayout>
      {data?.pages.length === 0 || data?.pages[0]?.data.length === 0 ? (
        <NothingMatched />
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

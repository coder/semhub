import { issuesSearchSchema } from "@/workers/server/router/schema";
import {
  infiniteQueryOptions,
  useSuspenseInfiniteQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { z } from "zod";

import { searchIssues } from "@/lib/api";
import { Button } from "@/components/ui/button";

const issuesInfiniteQueryOptions = ({
  q,
  p,
  lucky,
}: z.infer<typeof issuesSearchSchema>) => {
  return infiniteQueryOptions({
    queryKey: ["issues", q, p, lucky],
    queryFn: () => searchIssues({ query: q, pageParam: p, lucky }),
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
  validateSearch: issuesSearchSchema,
  loaderDeps: ({ search: { q, p, lucky } }) => ({ q, p, lucky }),
  component: () => <SearchResults />,
  loader: ({ context, deps: { p, q, lucky } }) => {
    context.queryClient.ensureInfiniteQueryData(
      issuesInfiniteQueryOptions({ q, p, lucky }),
    );
  },
});

function NothingMatched() {
  return <div>No issues matched your search</div>;
}

function SearchResults() {
  const { q, p, lucky } = Route.useSearch();
  const { data, isFetching, fetchNextPage, hasNextPage } =
    useSuspenseInfiniteQuery(issuesInfiniteQueryOptions({ q, p, lucky }));

  const redirectUrl = lucky && data?.pages[0]?.data[0]?.issueUrl;
  if (redirectUrl) {
    window.location.href = redirectUrl;
    return (
      <div className="mx-auto mt-8 flex flex-col items-center justify-center">
        <Loader2Icon className="animate-spin" />
        <p className="mt-2 text-sm text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Issues</h1>
      {/* <SortBar sortBy={sortBy} order={order} /> */}
      <div className="space-y-4">
        {data?.pages.length === 0 || data?.pages[0]?.data.length === 0 ? (
          <NothingMatched />
        ) : (
          data?.pages.map((page) =>
            page.data.map((issue) => (
              <div key={issue.id}>
                <a href={issue.issueUrl}>{issue.title}</a>
              </div>
            )),
          )
        )}
      </div>
      <div className="mt-6">
        <Button
          onClick={() => fetchNextPage()}
          disabled={!hasNextPage || isFetching}
        >
          {isFetching
            ? "Loading more..."
            : hasNextPage
              ? "Load more"
              : "Nothing more"}
        </Button>
      </div>
    </div>
  );
}

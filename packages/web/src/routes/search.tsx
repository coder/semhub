import { createFileRoute } from "@tanstack/react-router";
import {
  infiniteQueryOptions,
  useSuspenseInfiniteQuery,
} from "@tanstack/react-query";

import { z } from "zod";

import { searchIssues } from "@/lib/api";
import { Button } from "@/components/ui/button";

const issuesSearchSchema = z.object({
  q: z.string(),
  p: z.string().pipe(z.coerce.number().int().positive()).optional(),
});

const issuesInfiniteQueryOptions = ({
  q,
  p,
}: z.infer<typeof issuesSearchSchema>) => {
  return infiniteQueryOptions({
    queryKey: ["issues", q, p],
    queryFn: () => searchIssues({ query: q, pageParam: p }),
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
  component: () => <SearchResults />,
  loaderDeps: ({ search: { q, p } }) => ({ q, p }),
  loader: ({ context, deps: { p, q } }) => {
    context.queryClient.ensureInfiniteQueryData(
      issuesInfiniteQueryOptions({ q, p }),
    );
  },
});

function SearchResults() {
  const { q, p } = Route.useSearch();
  const { data, isFetching, fetchNextPage, hasNextPage } =
    useSuspenseInfiniteQuery(issuesInfiniteQueryOptions({ q, p }));
  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Issues</h1>
      {/* <SortBar sortBy={sortBy} order={order} /> */}
      <div className="space-y-4">
        {data?.pages.map((page) =>
          page.data.map((issue) => <div key={issue.id}>{issue.title}</div>),
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

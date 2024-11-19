import { issuesSearchSchema } from "@/workers/server/router/schema";
import {
  infiniteQueryOptions,
  useSuspenseInfiniteQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { z } from "zod";

import { searchIssues, SearchIssuesResponse } from "@/lib/api";
import { getDaysAgo } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchBar } from "@/components/SearchBars";

const issuesInfiniteQueryOptions = ({
  q,
  page,
  lucky,
}: z.infer<typeof issuesSearchSchema>) => {
  return infiniteQueryOptions({
    queryKey: ["issues", q, page, lucky],
    queryFn: () => searchIssues({ query: q, pageParam: page, lucky }),
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
  loaderDeps: ({ search: { q, page, lucky } }) => ({ q, page, lucky }),
  component: () => <SearchResults />,
  pendingComponent: () => <SearchResultsSkeleton />,
  loader: ({ context, deps: { page, q, lucky } }) => {
    context.queryClient.ensureInfiniteQueryData(
      issuesInfiniteQueryOptions({ q, page, lucky }),
    );
  },
});

function NothingMatched() {
  return (
    <div className="divide-y rounded-lg border bg-background p-4">
      <div>No issues matched your search</div>
    </div>
  );
}

type Issue = SearchIssuesResponse["data"][number];

function IssueCard({ issue }: { issue: Issue }) {
  const openedAtRelativeString = getDaysAgo(new Date(issue.issueCreatedAt));
  const closedAtRelativeString = issue.issueClosedAt
    ? getDaysAgo(new Date(issue.issueClosedAt))
    : null;

  return (
    <div className="p-4 hover:bg-muted/50">
      <div className="flex flex-col gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="shrink-0">
            {issue.issueState === "OPEN" && (
              <div className="flex size-4 items-center justify-center rounded-full border-[1.5px] border-green-600 bg-transparent">
                <div className="size-1 rounded-full bg-green-600" />
              </div>
            )}
            {issue.issueState === "CLOSED" && (
              <div className="flex size-4 items-center justify-center rounded-full border-[1.5px] border-purple-600 bg-transparent">
                <svg
                  className="size-2.5 text-purple-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="inline items-center">
              <a
                href={issue.repoUrl ?? ""}
                className="inline-flex items-center rounded-md border bg-muted px-2 py-0.5 text-sm hover:bg-muted/80"
              >
                {issue.repoOwnerName}/{issue.repoName}
              </a>
              <span className="mx-1" />
              <a
                href={issue.issueUrl}
                className="text-lg font-semibold text-foreground hover:text-primary"
              >
                <span className="break-words">{issue.title}</span>
              </a>
              {issue.labels?.map((label) => (
                <Badge
                  key={label.name}
                  variant="secondary"
                  className="mx-1 inline-flex rounded-full px-2 py-0.5"
                  style={{
                    backgroundColor: `#${label.color}`,
                    color: `${parseInt(label.color, 16) > 0x7fffff ? "#000" : "#fff"}`,
                  }}
                >
                  {label.name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="ml-6 text-sm text-muted-foreground">
          #{issue.number} · {issue.author && <> by {issue.author.name}</>} was{" "}
          {issue.issueState === "OPEN" && `opened ${openedAtRelativeString}`}
          {issue.issueState === "CLOSED" && `closed ${closedAtRelativeString}`}
        </div>
      </div>
    </div>
  );
}

function IssuesSkeleton() {
  return (
    <div className="divide-y rounded-lg border bg-background">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="p-4">
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
    <div className="mx-auto max-w-4xl">
      <div className="space-y-4">
        <div className="w-full">
          <SearchBar query={q} />
        </div>
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}

function SearchResults() {
  const { q, page, lucky } = Route.useSearch();
  const { data, isFetching, fetchNextPage, hasNextPage } =
    useSuspenseInfiniteQuery(issuesInfiniteQueryOptions({ q, page, lucky }));

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

function SearchResultsSkeleton() {
  return (
    <SearchLayout>
      <IssuesSkeleton />
    </SearchLayout>
  );
}

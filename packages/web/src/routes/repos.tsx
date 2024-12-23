import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLinkIcon, GitForkIcon } from "lucide-react";

import { Skeleton } from "../components/ui/skeleton";
import { client } from "../lib/api/client";
import { cn } from "../lib/utils";

function useReposQuery() {
  return useSuspenseQuery({
    queryKey: ["repos", "list"],
    queryFn: async () => {
      const response = await client.me.repos.list.$get();
      const res = await response.json();
      if (!res.success) {
        throw new Error(res.error);
      }
      return res.data;
    },
  });
}

type Repo = NonNullable<ReturnType<typeof useReposQuery>["data"]>[number];

function SubscribeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
    >
      Subscribe +
    </button>
  );
}

function RepoCard({ repo }: { repo: Repo }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">
            {repo.owner}/{repo.name}
          </h3>
          {repo.isPrivate && (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
              Private
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            Last synced:{" "}
            {repo.lastSyncedAt
              ? new Date(repo.lastSyncedAt).toLocaleString()
              : "Never"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={repo.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md p-2 hover:bg-muted"
        >
          <ExternalLinkIcon className="size-4" />
        </a>
        <button className="rounded-md p-2 hover:bg-muted">
          <GitForkIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}

function RepoSection({
  title,
  type,
  repos,
  onSubscribe,
}: {
  title: string;
  type: "public" | "private";
  repos: Repo[];
  onSubscribe: (type: "public" | "private") => Promise<void>;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <SubscribeButton onClick={() => onSubscribe(type)} />
      </div>
      <div
        className={cn("space-y-2", !repos.length && "text-sm text-gray-500")}
      >
        {repos.length === 0 ? (
          <p>No subscribed {type} repositories</p>
        ) : (
          repos.map((repo) => <RepoCard key={repo.id} repo={repo} />)
        )}
      </div>
    </section>
  );
}

function RepoSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="size-8 rounded-md" />
      </div>
    </div>
  );
}

function ReposSkeleton() {
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <RepoSkeleton key={i} />
          ))}
        </div>
      </section>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <RepoSkeleton key={i} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ReposPage() {
  const { data: reposData } = useReposQuery();

  const handleSubscribeRepo = async (type: "public" | "private") => {
    try {
      const response = await client.me.repos.subscribe[type].$post();
      const data = await response.json();
      console.log("Response:", data);
      // You can add a toast notification here to show success/error
    } catch (error) {
      console.error("Error subscribing to repo:", error);
    }
  };

  const publicRepos = reposData?.filter((repo) => !repo.isPrivate) ?? [];
  const privateRepos = reposData?.filter((repo) => repo.isPrivate) ?? [];
  const hasRepos = publicRepos.length > 0 || privateRepos.length > 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-8 text-center text-2xl font-bold">My Repositories</h1>
        <>
          {!hasRepos && <EmptyState />}
          <div className="space-y-8">
            <RepoSection
              title="Public Repositories"
              type="public"
              repos={publicRepos}
              onSubscribe={handleSubscribeRepo}
            />
            <RepoSection
              title="Private Repositories"
              type="private"
              repos={privateRepos}
              onSubscribe={handleSubscribeRepo}
            />
          </div>
        </>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mb-8 rounded-lg border-2 border-dashed p-8 text-center text-gray-500">
      <p className="mb-2">No repositories subscribed yet</p>
      <p className="text-sm">
        Subscribe to your first repository to get started
      </p>
    </div>
  );
}

export const Route = createFileRoute("/repos")({
  component: ReposPage,
  pendingComponent: () => (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-8 text-center text-2xl font-bold">My Repositories</h1>
        <ReposSkeleton />
      </div>
    </div>
  ),
});

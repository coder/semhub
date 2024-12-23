import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { InfoIcon } from "lucide-react";

import { client } from "@/lib/api/client";
import { queryKeys } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AddRepoModal } from "@/components/AddRepoModal";
import { RepoCard } from "@/components/RepoCard";

function useReposQuery() {
  return useSuspenseQuery({
    queryKey: queryKeys.repos.list,
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

export type Repo = NonNullable<
  ReturnType<typeof useReposQuery>["data"]
>[number];

type RepoType = "public" | "private";

interface RepoSectionProps {
  title: string;
  type: RepoType;
  repos: Repo[];
  onSubscribe: (type: RepoType, owner: string, repo: string) => Promise<void>;
}

function RepoSection({ title, type, repos, onSubscribe }: RepoSectionProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <AddRepoModal type={type} onSubscribe={onSubscribe} />
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

function EmptyState() {
  return (
    <Alert variant="default" className="mb-8">
      <InfoIcon className="size-4" />
      <AlertTitle>No repositories</AlertTitle>
      <AlertDescription>
        Subscribe to your first repository to get started with SemHub.
      </AlertDescription>
    </Alert>
  );
}

function ReposSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-8 text-center text-2xl font-bold">My Repositories</h1>
        <div className="space-y-8">
          {/* Public Repos Section */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-10 w-28 rounded-md" />
            </div>
            <div className="space-y-2">
              <div className="text-sm">
                <Skeleton className="h-5 w-48" />
              </div>
            </div>
          </section>
          {/* Private Repos Section */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-10 w-28 rounded-md" />
            </div>
            <div className="space-y-2">
              <div className="text-sm">
                <Skeleton className="h-5 w-48" />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ReposPage() {
  const { data: reposData } = useReposQuery();

  const handleSubscribeRepo = async (
    type: RepoType,
    owner: string,
    repo: string,
  ) => {
    try {
      const response = await client.me.repos.subscribe[type].$post({
        json: { owner, repo },
      });
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
            <TooltipProvider>
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
            </TooltipProvider>
          </div>
        </>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/repos")({
  component: ReposPage,
  pendingComponent: ReposSkeleton,
});

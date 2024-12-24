import { createFileRoute } from "@tanstack/react-router";
import { InfoIcon } from "lucide-react";

import { Repo, RepoType, useReposQuery } from "@/lib/hooks/useRepo";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RepoCard } from "@/components/RepoCard";
import { SubscribeRepoDialog } from "@/components/SubscribeRepoDialog";

interface RepoSectionProps {
  title: string;
  type: RepoType;
  repos: Repo[];
}

function RepoSection({ title, type, repos }: RepoSectionProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <SubscribeRepoDialog type={type} />
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

function ReposPage() {
  const { data: reposData } = useReposQuery();

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
              />
              <RepoSection
                title="Private Repositories"
                type="private"
                repos={privateRepos}
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

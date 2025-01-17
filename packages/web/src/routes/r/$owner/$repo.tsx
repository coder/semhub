import { createFileRoute } from "@tanstack/react-router";
import { CheckIcon, CopyIcon, InfoIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { useRepoStatus } from "@/lib/hooks/useRepo";
import { getTimeAgo } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { FastTooltip } from "@/components/ui/fast-tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RepoSearchBar } from "@/components/search/RepoSearchBar";

export const Route = createFileRoute("/r/$owner/$repo")({
  component: RepoSearch,
});

function TimeDisplay({ label, date }: { label: string; date: string | null }) {
  if (!date) return null;
  const dateObj = new Date(date);
  return (
    <span>
      {label}: {getTimeAgo(dateObj)}
    </span>
  );
}

function RepoSearch() {
  const { owner, repo } = Route.useParams();
  const [copied, setCopied] = useState(false);

  const imgSrc =
    "https://img.shields.io/badge/search-semhub-blue?style=flat&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgNTEyIDUxMiI%2BCiAgPHBhdGggZmlsbD0iY3VycmVudENvbG9yIiBkPSJNNDE0IDM1NHEtMTgtMTgtNDEtMTFsLTMyLTMycTQzLTUzIDQzLTExOXEwLTgwLTU2LTEzNlQxOTIgMFQ1NiA1NlQwIDE5MnQ1NiAxMzZ0MTM2IDU2cTcwIDAgMTE5LTQzbDMyIDMycS02IDI0IDExIDQxbDg1IDg1cTEzIDEzIDMwIDEzcTE4IDAgMzAtMTNxMTMtMTMgMTMtMzB0LTEzLTMwem0tMjIyLTEzcS02MiAwLTEwNS41LTQzLjVUNDMgMTkyVDg2LjUgODYuNVQxOTIgNDN0MTA1LjUgNDMuNVQzNDEgMTkydC00My41IDEwNS41VDE5MiAzNDF6Ii8%2BCjwvc3ZnPg%3D%3D";

  const embedCode = `<a href="https://semhub.dev/r/${owner}/${repo}"><img src="${imgSrc}" alt="Search with SemHub"></a>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const { data: repoStatus } = useRepoStatus(owner, repo);

  if (!repoStatus) {
    return (
      <div className="relative flex w-full flex-col items-center justify-center pt-28">
        <h1 className="mb-4 text-3xl font-bold">Repository Not Found</h1>
        <p className="text-muted-foreground">
          The repository{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            {owner}/{repo}
          </code>{" "}
          could not be found.
        </p>
        <p className="mt-2 text-muted-foreground">
          Please ensure this repository has been added to Semhub.
        </p>
      </div>
    );
  }
  const { avatarUrl, issuesLastUpdatedAt, lastSyncedAt } = repoStatus;

  return (
    <div className="relative flex w-full justify-center pt-28">
      <div className="w-full max-w-screen-xl px-4">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-2 flex items-center gap-2">
            <img
              src={avatarUrl}
              alt={`${owner}'s avatar`}
              className="size-6 translate-y-px rounded-full"
            />
            <h1 className="text-center font-serif text-3xl tracking-tight">
              <a
                href={`https://github.com/${owner}/${repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center"
              >
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xl hover:bg-muted/80">
                  {owner}/{repo}
                </code>
              </a>
            </h1>
          </div>
          <h2 className="mb-8 text-center font-serif text-lg italic tracking-tight text-muted-foreground">
            Uncover insights with{" "}
            <span className="text-blue-600 dark:text-blue-500">Sem</span>antic
            search for Git
            <span className="text-orange-500">Hub</span>
          </h2>
          <div className="mx-auto w-full max-w-2xl">
            <RepoSearchBar owner={owner} repo={repo} />
          </div>
        </div>
      </div>
      <div className="fixed bottom-8 right-8 flex items-center gap-2">
        <TooltipProvider>
          <FastTooltip
            content={
              <div className="flex flex-col gap-1 text-sm">
                <TimeDisplay label="Last synced" date={lastSyncedAt} />
                <TimeDisplay
                  label="Issues updated"
                  date={issuesLastUpdatedAt}
                />
              </div>
            }
          >
            <Button variant="outline" size="sm">
              <InfoIcon className="size-4" />
            </Button>
          </FastTooltip>
        </TooltipProvider>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <PlusIcon className="size-4" />
              <span>Add</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96" align="end">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Add to your repo</div>
                <p className="text-sm text-muted-foreground">
                  Add semantic search to your repository by embedding this badge
                  in your README and loading your repo into SemHub.
                </p>
                <div className="flex items-center justify-center rounded border bg-muted/30 p-3">
                  <img src={imgSrc} alt="Search with SemHub" />
                </div>
                <div className="relative">
                  <div className="group rounded border bg-muted/50 p-3">
                    <pre className="overflow-x-auto text-xs">
                      <code>{embedCode}</code>
                    </pre>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute right-2 top-2 gap-1.5"
                      onClick={copyToClipboard}
                    >
                      {copied ? (
                        <>
                          <CheckIcon className="size-3 text-green-500" />
                          <span className="text-xs">Copied!</span>
                        </>
                      ) : (
                        <>
                          <CopyIcon className="size-3" />
                          <span className="text-xs">Copy</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

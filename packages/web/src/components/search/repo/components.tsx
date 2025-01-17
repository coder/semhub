import { CheckIcon, CopyIcon, InfoIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { getTimeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FastTooltip } from "@/components/ui/fast-tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TooltipProvider } from "@/components/ui/tooltip";

function TimeDisplay({ label, date }: { label: string; date: string | null }) {
  if (!date) return null;
  const dateObj = new Date(date);
  return (
    <span>
      {label}: {getTimeAgo(dateObj)}
    </span>
  );
}

function StatusDisplay({
  label,
  status,
}: {
  label: string;
  status: string | null;
}) {
  if (!status) return null;
  return (
    <span>
      {label}: {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
    </span>
  );
}

export function RepoStatusTooltip({
  lastSyncedAt,
  issuesLastUpdatedAt,
  syncStatus,
}: {
  lastSyncedAt: string | null;
  issuesLastUpdatedAt: string | null;
  syncStatus: string | null;
}) {
  return (
    <TooltipProvider>
      <FastTooltip
        content={
          <div className="flex flex-col gap-1 text-sm">
            <StatusDisplay label="Repo status" status={syncStatus} />
            <TimeDisplay label="Last synced" date={lastSyncedAt} />
            <TimeDisplay label="Issues updated" date={issuesLastUpdatedAt} />
          </div>
        }
      >
        <span
          className={cn(
            "inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          <InfoIcon className="size-4" />
        </span>
      </FastTooltip>
    </TooltipProvider>
  );
}

export function EmbedBadgePopover({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
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

  return (
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
              Add semantic search to your repository by embedding this badge in
              your README and loading your repo into SemHub.
            </p>
            <div className="flex items-center justify-center rounded border bg-muted/30 p-3">
              <a href={`https://semhub.dev/r/${owner}/${repo}`}>
                <img src={imgSrc} alt="Search with SemHub" />
              </a>
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
  );
}

import { ExternalLinkIcon, HourglassIcon, XCircleIcon } from "lucide-react";

import { Repo } from "@/lib/hooks/useRepo";
import { formatLocalDateTime, getTimeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { FastTooltip } from "@/components/ui/fast-tooltip";

import { UnsubscribeRepoDialog } from "./UnsubscribeRepoDialog";

export function RepoCard({ repo }: { repo: Repo }) {
  const abnormalSyncState = getAbnormalSyncState(
    repo.initStatus,
    repo.syncStatus,
  );

  return (
    <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <img
            src={repo.ownerAvatarUrl}
            alt={`${repo.ownerName}'s avatar`}
            className="size-6 rounded-full"
          />
          <h3 className="font-medium">
            {repo.ownerName}/{repo.name}
          </h3>
          {abnormalSyncState && abnormalSyncState.render()}
        </div>
        {repo.initStatus === "completed" && repo.syncStatus !== "error" && (
          <TimestampInfo repo={repo} />
        )}
      </div>
      <div className="flex items-center gap-2">
        <UnsubscribeRepoDialog repo={repo} />
        <a
          href={repo.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md p-2 hover:bg-muted"
        >
          <ExternalLinkIcon className="size-4" />
        </a>
      </div>
    </div>
  );
}

type SyncState = {
  text: string;
  className: string;
  variant: "default" | "secondary";
  icon: typeof XCircleIcon | typeof HourglassIcon;
  tooltip: string | null;
  render: () => React.ReactNode;
};

function getAbnormalSyncState(
  initStatus: Repo["initStatus"],
  syncStatus: Repo["syncStatus"],
): SyncState | null {
  const createState = (state: Omit<SyncState, "render">): SyncState => ({
    ...state,
    render: () => {
      const badge = (
        <Badge
          variant={state.variant}
          className={cn("flex items-center gap-1 px-1 py-0.5", state.className)}
        >
          <state.icon className="size-3.5" />
          <span>{state.text}</span>
        </Badge>
      );

      return state.tooltip ? (
        <FastTooltip content={state.tooltip}>{badge}</FastTooltip>
      ) : (
        badge
      );
    },
  });

  switch (initStatus) {
    case "error":
      return createState({
        text: "Initialization failed",
        className:
          "bg-red-100 text-red-800 hover:bg-red-100 hover:text-red-800",
        variant: "secondary",
        icon: XCircleIcon,
        tooltip: "Please contact us if this error persists",
      });
    case "ready":
      return createState({
        text: "Waiting to be initialized",
        className:
          "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 hover:text-yellow-800",
        variant: "secondary",
        icon: HourglassIcon,
        tooltip: null,
      });
    case "in_progress":
      return createState({
        text: "Initializing...",
        className:
          "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 hover:text-yellow-800",
        variant: "secondary",
        icon: HourglassIcon,
        tooltip: null,
      });
    case "completed":
      switch (syncStatus) {
        case "error":
          return createState({
            text: "Syncing failed",
            className:
              "bg-red-100 text-red-800 hover:bg-red-100 hover:text-red-800",
            variant: "secondary",
            icon: XCircleIcon,
            tooltip: "Please contact us if this error persists",
          });
        case "queued":
        case "in_progress":
          return createState({
            text: "Syncing...",
            className:
              "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 hover:text-yellow-800",
            variant: "secondary",
            tooltip: null,
            icon: HourglassIcon,
          });
        case "ready":
          return null;
      }
      syncStatus satisfies never;
  }
  initStatus satisfies never;
}

function TimestampInfo({ repo }: { repo: Repo }) {
  function TimeDisplay({
    label,
    date,
  }: {
    label: string;
    date: Date | string;
  }) {
    const dateObj = date instanceof Date ? date : new Date(date);

    return (
      <FastTooltip content={formatLocalDateTime(dateObj)}>
        <span>
          {label}: {getTimeAgo(dateObj)}
        </span>
      </FastTooltip>
    );
  }

  function Separator() {
    return <span className="px-1 text-muted-foreground">|</span>;
  }

  if (!repo.lastSyncedAt || !repo.issueLastUpdatedAt) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5 text-sm text-muted-foreground">
      <TimeDisplay label="Last synced" date={repo.lastSyncedAt} />
      <Separator />
      <TimeDisplay label="Issues updated" date={repo.issueLastUpdatedAt} />
      <Separator />
      <TimeDisplay label="Subscribed" date={repo.repoSubscribedAt} />
    </div>
  );
}

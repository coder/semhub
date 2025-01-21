import { Link } from "@tanstack/react-router";
import {
  ExternalLinkIcon,
  HourglassIcon,
  InfoIcon,
  XCircleIcon,
} from "lucide-react";
import React from "react";

import type { Repo } from "@/lib/hooks/useRepo";
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
            {!repo.isPrivate ? (
              <Link
                to="/r/$owner/$repo"
                params={{
                  owner: repo.ownerName,
                  repo: repo.name,
                }}
                className="hover:underline"
              >
                {repo.ownerName}/{repo.name}
              </Link>
            ) : (
              <>
                {repo.ownerName}/{repo.name}
              </>
            )}
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
    // should never happen because filtered out in backend
    case "pending": {
      return null;
    }
    case "error":
      return createState({
        text: "Initialization failed",
        className:
          "bg-red-100 text-red-800 hover:bg-red-100 hover:text-red-800",
        variant: "secondary",
        icon: XCircleIcon,
        tooltip: "Please contact us if this error persists",
      });
    case "no_issues":
      return createState({
        text: "Repo has no issues",
        className:
          "bg-orange-100 text-orange-800 hover:bg-orange-100 hover:text-orange-800",
        variant: "secondary",
        icon: InfoIcon,
        tooltip: "SemHub currently only supports issues, not pull requests",
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
  function TimeDisplay({ label, date }: { label: string; date: string }) {
    const dateObj = new Date(date);

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

  const timestamps = [
    { label: "Last synced", date: repo.lastSyncedAt },
    { label: "Issues updated", date: repo.issuesLastUpdatedAt },
    { label: "Subscribed", date: repo.repoSubscribedAt },
  ].filter(
    (item): item is { label: string; date: string } => item.date !== null,
  );

  if (timestamps.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5 text-sm text-muted-foreground">
      {timestamps.map((item, index) => (
        <React.Fragment key={item.label}>
          <TimeDisplay label={item.label} date={item.date} />
          {index < timestamps.length - 1 && <Separator />}
        </React.Fragment>
      ))}
    </div>
  );
}

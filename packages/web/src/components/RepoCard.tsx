import { ExternalLinkIcon, HourglassIcon, XCircleIcon } from "lucide-react";

import { formatLocalDateTime, getTimeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { FastTooltip } from "@/components/ui/fast-tooltip";
import type { Repo } from "@/routes/repos";

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
          className={cn("flex items-center gap-1.5", state.className)}
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

// function PrivacyBadge({ isPrivate }: { isPrivate: boolean }) {
//   return (
//     <Badge
//       variant="secondary"
//       className={cn(
//         "rounded-full px-2 py-0.5",
//         isPrivate ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800",
//       )}
//     >
//       {isPrivate ? "Private" : "Public"}
//     </Badge>
//   );
// }

function Separator() {
  return <span className="px-1 text-muted-foreground">|</span>;
}

function TimestampInfo({ repo }: { repo: Repo }) {
  if (!repo.lastSyncedAt || !repo.issueLastUpdatedAt) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5 text-sm text-muted-foreground">
      <FastTooltip content={formatLocalDateTime(new Date(repo.lastSyncedAt))}>
        <span>Last synced: {getTimeAgo(new Date(repo.lastSyncedAt))}</span>
      </FastTooltip>
      <Separator />
      <FastTooltip
        content={formatLocalDateTime(new Date(repo.issueLastUpdatedAt))}
      >
        <span>
          Issues updated: {getTimeAgo(new Date(repo.issueLastUpdatedAt))}
        </span>
      </FastTooltip>
      <Separator />
      <FastTooltip
        content={formatLocalDateTime(new Date(repo.repoSubscribedAt))}
      >
        <span>Subscribed: {getTimeAgo(new Date(repo.repoSubscribedAt))}</span>
      </FastTooltip>
    </div>
  );
}

export function RepoCard({ repo }: { repo: Repo }) {
  const abnormalSyncState = getAbnormalSyncState(
    repo.initStatus,
    repo.syncStatus,
  );

  return (
    <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">
            {repo.ownerName}/{repo.name}
          </h3>
          {abnormalSyncState && abnormalSyncState.render()}
          {/* <PrivacyBadge isPrivate={repo.isPrivate} /> */}
        </div>
        {repo.initStatus === "completed" && repo.syncStatus !== "error" && (
          <TimestampInfo repo={repo} />
        )}
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
      </div>
    </div>
  );
}

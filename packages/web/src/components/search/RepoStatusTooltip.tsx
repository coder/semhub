import { InfoIcon } from "lucide-react";

import { RepoStatus } from "@/lib/hooks/useRepo";
import { getTimeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import { FastTooltip } from "@/components/ui/fast-tooltip";
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
  initStatus,
  syncStatus,
}: {
  initStatus: RepoStatus["initStatus"];
  syncStatus: RepoStatus["syncStatus"];
}) {
  let displayText = "";

  if (initStatus && initStatus !== "completed") {
    displayText = `Initialization: ${initStatus.charAt(0).toUpperCase() + initStatus.slice(1).toLowerCase()}`;
  } else if (syncStatus) {
    displayText = `Status: ${syncStatus.charAt(0).toUpperCase() + syncStatus.slice(1).toLowerCase()}`;
  }

  return displayText ? <span>{displayText}</span> : null;
}

export function RepoStatusTooltip({
  lastSyncedAt,
  issuesLastUpdatedAt,
  syncStatus,
  initStatus,
}: {
  lastSyncedAt: RepoStatus["lastSyncedAt"];
  issuesLastUpdatedAt: RepoStatus["issuesLastUpdatedAt"];
  syncStatus: RepoStatus["syncStatus"];
  initStatus: RepoStatus["initStatus"];
}) {
  return (
    <TooltipProvider>
      <FastTooltip
        content={
          <div className="flex flex-col gap-1 text-sm">
            <StatusDisplay initStatus={initStatus} syncStatus={syncStatus} />
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

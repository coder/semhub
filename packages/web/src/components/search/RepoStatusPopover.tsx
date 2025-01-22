import { InfoIcon } from "lucide-react";

import type { RepoStatus } from "@/lib/hooks/useRepo";
import { getTimeAgo } from "@/lib/time";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

export function RepoStatusPopover({
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
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <InfoIcon className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Repository Status</div>
            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              <StatusDisplay initStatus={initStatus} syncStatus={syncStatus} />
              <TimeDisplay label="Last synced" date={lastSyncedAt} />
              <TimeDisplay label="Issues updated" date={issuesLastUpdatedAt} />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

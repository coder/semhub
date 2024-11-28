import { CircleCheckIcon, CircleDotIcon, CircleSlashIcon } from "lucide-react";

import type { SearchIssuesResponse } from "@/lib/api";
import { getTimeAgo } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function IssueCard({ issue }: { issue: Issue }) {
  const openedAtRelativeString = getTimeAgo(new Date(issue.issueCreatedAt));
  const closedAtRelativeString = issue.issueClosedAt
    ? getTimeAgo(new Date(issue.issueClosedAt))
    : null;

  const { issueState, issueStateReason } = issue;
  const { icon: StateIcon, color } = getIssueStateIcon(
    issueState,
    issueStateReason,
  );

  const repoLink = (
    <a
      href={issue.repoUrl ?? ""}
      className="inline-flex items-center rounded-md border bg-muted px-2 py-0.5 text-sm hover:bg-muted/80"
    >
      {issue.repoOwnerName}/{issue.repoName}
    </a>
  );

  return (
    <div className="p-4 hover:bg-muted/50">
      <div className="flex flex-col gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex shrink-0 items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <StateIcon className={`size-4 ${color}`} />
                  </TooltipTrigger>
                  <TooltipContent>
                    {toTitleCase(issueStateReason || issueState)}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {issue.repoLastUpdatedAt ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>{repoLink}</TooltipTrigger>
                    <TooltipContent>
                      Last synced{" "}
                      {getTimeAgo(new Date(issue.repoLastUpdatedAt))}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                repoLink
              )}
            </div>
            <a
              href={issue.issueUrl}
              className="min-w-0 text-lg font-semibold text-foreground hover:text-primary"
            >
              <span className="line-clamp-2 [word-break:break-word]">
                {issue.title}
              </span>
            </a>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {issue.labels?.map((label) => (
                <Badge
                  key={label.name}
                  variant="secondary"
                  className="inline-flex rounded-full px-2 py-0.5"
                  style={{
                    backgroundColor: `#${label.color}`,
                    color: `${parseInt(label.color, 16) > 0x7fffff ? "#000" : "#fff"}`,
                  }}
                >
                  {label.name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="ml-6 text-sm text-muted-foreground">
          #{issue.number} {issue.author && <> by {issue.author.name}</>} was{" "}
          {issueState === "OPEN" && `opened ${openedAtRelativeString}`}
          {issueState === "CLOSED" && `closed ${closedAtRelativeString}`} |{" "}
          {issue.commentCount}{" "}
          {issue.commentCount <= 1 ? "comment" : "comments"}
        </div>
      </div>
    </div>
  );
}

function toTitleCase(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

type Issue = SearchIssuesResponse["data"][number];

type IssueStateIcon = {
  icon: typeof CircleCheckIcon | typeof CircleDotIcon | typeof CircleSlashIcon;
  color: string;
};

function getIssueStateIcon(
  state: string,
  reason?: string | null,
): IssueStateIcon {
  if (state === "OPEN" || state === "REOPENED") {
    return { icon: CircleDotIcon, color: "text-green-600" };
  }

  if (state === "CLOSED") {
    if (reason === "NOT_PLANNED" || reason === "DUPLICATE") {
      return { icon: CircleSlashIcon, color: "text-gray-500" };
    }
    return { icon: CircleCheckIcon, color: "text-purple-600" };
  }

  // Default fallback
  return { icon: CircleDotIcon, color: "text-green-600" };
}

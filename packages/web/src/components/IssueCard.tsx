import { CircleCheckIcon, CircleDotIcon, CircleSlashIcon } from "lucide-react";

import type { SearchIssuesResponse } from "@/lib/api";
import { formatLocalDateTime, getTimeAgo } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function IssueCard({ issue }: { issue: Issue }) {
  return (
    <div className="p-4 hover:bg-muted/50">
      <div className="flex flex-col gap-2">
        <TooltipProvider>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <IssueStateIndicator
                state={issue.issueState}
                reason={issue.issueStateReason}
              />
              <IssueTitleWithLabels issue={issue} />
            </div>
          </div>
          <div className="ml-6 text-sm text-muted-foreground">
            <RepoTag issue={issue} /> <IssueMetadata issue={issue} />
          </div>
        </TooltipProvider>
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
  state: Issue["issueState"],
  reason: Issue["issueStateReason"],
): IssueStateIcon {
  switch (state) {
    case "OPEN":
      return { icon: CircleDotIcon, color: "text-green-600" };
    case "CLOSED":
      switch (reason) {
        case "REOPENED":
          return { icon: CircleDotIcon, color: "text-green-600" };
        case "NOT_PLANNED":
        case "DUPLICATE":
          return { icon: CircleSlashIcon, color: "text-gray-500" };
        default:
          return { icon: CircleCheckIcon, color: "text-purple-600" };
      }
    default:
      state satisfies never;
      throw new Error(`Unknown issue state: ${state} with reason: ${reason}`);
  }
}

function IssueStateIndicator({
  state,
  reason,
}: {
  state: Issue["issueState"];
  reason: Issue["issueStateReason"];
}) {
  const { icon: StateIcon, color } = getIssueStateIcon(state, reason);
  return (
    <FastTooltip content={toTitleCase(reason || state)}>
      <StateIcon className={`size-5 ${color}`} />
    </FastTooltip>
  );
}

function RepoTag({ issue }: { issue: Issue }) {
  const repoName = (
    <a
      href={issue.repoUrl ?? ""}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center rounded-md border bg-muted px-2 py-0.5 text-sm hover:bg-muted/80"
    >
      {issue.repoOwnerName}/{issue.repoName}
    </a>
  );

  if (!issue.repoLastUpdatedAt) return repoName;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{repoName}</TooltipTrigger>
      <TooltipContent>
        Last synced {getTimeAgo(new Date(issue.repoLastUpdatedAt))}
      </TooltipContent>
    </Tooltip>
  );
}

function IssueTitleWithLabels({ issue }: { issue: Issue }) {
  return (
    <div className="min-w-0 grow text-lg font-semibold">
      <a
        href={issue.issueUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground hover:text-primary"
      >
        <span className="[word-break:break-word]">{issue.title}</span>
      </a>
      {issue.labels && issue.labels.length > 0 && (
        <span className="ml-2 inline-flex gap-2">
          {issue.labels.map((label) => (
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
        </span>
      )}
    </div>
  );
}

function IssueMetadata({ issue }: { issue: Issue }) {
  const openedAt = getTimeAgo(new Date(issue.issueCreatedAt));
  const closedAt = issue.issueClosedAt
    ? getTimeAgo(new Date(issue.issueClosedAt))
    : null;
  const updatedAt = getTimeAgo(new Date(issue.issueUpdatedAt));
  const { issueState } = issue;

  const issueNumber = (
    <a href={issue.issueUrl} target="_blank" rel="noopener noreferrer">
      #{issue.number}
    </a>
  );

  const authorElement = issue.author && (
    <a
      href={issue.author.htmlUrl}
      className="hover:text-primary"
      target="_blank"
      rel="noopener noreferrer"
    >
      {issue.author.name}
    </a>
  );

  const stateTimestamp = (
    <FastTooltip
      content={formatLocalDateTime(
        new Date(
          issueState === "OPEN" ? issue.issueCreatedAt : issue.issueClosedAt!,
        ),
      )}
    >
      {issueState === "OPEN" ? `opened ${openedAt}` : `closed ${closedAt}`}
    </FastTooltip>
  );

  const commentElement = (
    <>
      {issue.commentCount} {issue.commentCount === 1 ? "comment" : "comments"}
    </>
  );

  const showLastUpdated =
    (issueState === "OPEN" && updatedAt !== openedAt) ||
    (issueState === "CLOSED" && updatedAt !== closedAt);

  const lastUpdatedElement = (
    <FastTooltip content={formatLocalDateTime(new Date(issue.issueUpdatedAt))}>
      updated {updatedAt}
    </FastTooltip>
  );

  return (
    <>
      {issueNumber} by {authorElement} was {stateTimestamp} | {commentElement}
      {showLastUpdated && " | "}
      {showLastUpdated && lastUpdatedElement}
    </>
  );
}

function FastTooltip({
  children,
  content,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
}) {
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger className="cursor-default">{children}</TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  );
}

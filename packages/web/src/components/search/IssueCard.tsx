import DOMPurify from "dompurify";
import {
  CircleCheckIcon,
  CircleDotIcon,
  CircleSlashIcon,
  MessageSquareIcon,
} from "lucide-react";

import type { PublicSearchIssuesResponse } from "@/lib/api/search";
import { formatLocalDateTime, getTimeAgo } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { FastTooltip } from "@/components/ui/fast-tooltip";
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

type Issue = PublicSearchIssuesResponse["data"][number];

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
  }
  state satisfies never;
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
  if (!issue.repoLastSyncedAt) return repoName;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{repoName}</TooltipTrigger>
      <TooltipContent>
        Last synced {getTimeAgo(new Date(issue.repoLastSyncedAt))}
      </TooltipContent>
    </Tooltip>
  );
}

function getScoreColor(score: number): string {
  if (score > 0.5) return "bg-green-100 text-green-800";
  if (score >= 0.45) return "bg-blue-100 text-blue-800";
  if (score >= 0.4) return "bg-yellow-100 text-yellow-800";
  return "bg-gray-100 text-gray-800";
}

function ScoreBadge({ score }: { score: number }) {
  const colorClass = getScoreColor(score);
  return (
    <FastTooltip content="Match score">
      <span
        className={`mr-1.5 inline-flex rounded-md px-1.5 py-0.5 text-sm font-medium ${colorClass}`}
      >
        {(score * 100).toFixed(1)}%
      </span>
    </FastTooltip>
  );
}

function IssueTitleWithLabels({ issue }: { issue: Issue }) {
  const renderLabel = (label: Issue["labels"][number]) => {
    const badgeElement = (
      <Badge
        variant="secondary"
        className="mx-1 inline-flex rounded-full px-2 py-0.5"
        style={{
          backgroundColor: `#${label.color}`,
          color: `${parseInt(label.color, 16) > 0x7fffff ? "#000" : "#fff"}`,
        }}
      >
        {label.name}
      </Badge>
    );

    // description can be null or empty string
    if (!label.description || label.description.trim() === "")
      return badgeElement;

    return (
      <FastTooltip content={label.description}>{badgeElement}</FastTooltip>
    );
  };

  const processTitle = (title: string) => {
    return title.replace(/`([^`]+)`/g, "<code>$1</code>");
  };

  return (
    <div className="min-w-0 grow text-lg font-semibold">
      <ScoreBadge score={issue.rankingScore} />
      <a
        href={issue.issueUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground hover:text-primary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5"
      >
        <span
          className="[word-break:break-word]"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(processTitle(issue.title), {
              ALLOWED_TAGS: ["code"],
              ALLOWED_ATTR: [],
            }),
          }}
        />
      </a>
      {issue.labels && issue.labels.length > 0 && (
        <span className="ml-2 gap-2">
          {issue.labels.map((label) => (
            <span key={label.name}>{renderLabel(label)}</span>
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

  // we show 99+ because we only save the first 100 comments from GitHub API and 3-digit numbers may clutter
  const commentCount = issue.commentCount >= 100 ? "99+" : issue.commentCount;
  const commentElement = (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 hover:bg-muted/80">
          <MessageSquareIcon className="size-3.5" />
          <span className="text-xs leading-none">{commentCount}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {commentCount} {issue.commentCount === 1 ? "comment" : "comments"}
      </TooltipContent>
    </Tooltip>
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
      {issueNumber} by {authorElement} was {stateTimestamp}
      {showLastUpdated && " | "}
      {showLastUpdated && lastUpdatedElement} {commentElement}
    </>
  );
}

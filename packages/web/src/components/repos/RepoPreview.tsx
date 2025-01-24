import { GlobeIcon, LoaderIcon, LockIcon, StarIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type RepoPreviewProps = {
  name: string;
  description: string | null;
  owner: {
    login: string;
    avatarUrl: string;
  };
  private: boolean;
  stargazersCount: number;
} & {
  className?: string;
};

export function RepoPreview({
  name,
  description,
  owner,
  private: isPrivate,
  stargazersCount,
  className,
}: RepoPreviewProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 transition-colors hover:bg-accent/5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <img
          src={owner.avatarUrl}
          alt={owner.login}
          className="size-10 rounded-full ring-1 ring-border"
        />
        <div className="grid flex-1 gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium hover:underline">
              <a
                href={`https://github.com/${owner.login}/${name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1"
              >
                {owner.login}/{name}
              </a>
            </h3>
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <StarIcon className="size-4" />
                <span>{stargazersCount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                {isPrivate ? (
                  <LockIcon className="size-4" />
                ) : (
                  <GlobeIcon className="size-4" />
                )}
              </div>
            </div>
          </div>
          {description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function RepoPreviewSkeleton() {
  return (
    <div className="flex items-center justify-center py-4">
      <LoaderIcon className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

import { LoaderIcon } from "lucide-react";

export interface RepoPreviewProps {
  name: string;
  description: string | null;
  owner: {
    login: string;
    avatarUrl: string;
  };
  private: boolean;
  stargazersCount: number;
}

export function RepoPreview({
  name,
  description,
  owner,
  private: isPrivate,
  stargazersCount,
}: RepoPreviewProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <img
          src={owner.avatarUrl}
          alt={owner.login}
          className="size-10 rounded-full"
        />
        <div className="grid gap-1">
          <h3 className="font-medium">
            {owner.login}/{name}
          </h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{stargazersCount.toLocaleString()} stars</span>
            <span>{isPrivate ? "Private" : "Public"}</span>
          </div>
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

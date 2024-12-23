import { LoaderIcon } from "lucide-react";
import { z } from "zod";

const repoResponseSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  owner: z.object({
    login: z.string(),
    avatar_url: z.string(),
  }),
  private: z.boolean(),
  stargazers_count: z.number(),
});

export type RepoPreviewData = z.infer<typeof repoResponseSchema>;

interface RepoPreviewProps {
  data: RepoPreviewData;
}

export function RepoPreview({ data }: RepoPreviewProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <img
          src={data.owner.avatar_url}
          alt={data.owner.login}
          className="size-10 rounded-full"
        />
        <div className="grid gap-1">
          <h3 className="font-medium">
            {data.owner.login}/{data.name}
          </h3>
          {data.description && (
            <p className="text-sm text-muted-foreground">{data.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{data.stargazers_count.toLocaleString()} stars</span>
            <span>{data.private ? "Private" : "Public"}</span>
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

export { repoResponseSchema };

import { AlertCircleIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { repoSchema } from "@/core/github/schema.rest";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import {
  RepoPreview,
  RepoPreviewProps,
  RepoPreviewSkeleton,
} from "@/components/repos/RepoPreview";
import {
  githubRepoFormSchema,
  validateAndExtractGithubOwnerAndRepo,
} from "@/components/repos/subscribe";

import {
  CopyButton,
  getEmbedCode,
  SEMHUB_BADGE_IMG_SRC,
  useCopyToClipboard,
} from "./embed";

export function EmbedBadgeInput() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [repoInput, setRepoInput] = useState("");
  const [preview, setPreview] = useState<RepoPreviewProps | null>(null);

  const embedCode = preview
    ? getEmbedCode(preview.owner.login, preview.name)
    : "";
  const { copied, copyToClipboard } = useCopyToClipboard(embedCode);

  const fetchPreview = async (owner: string, repo: string) => {
    try {
      setIsLoadingPreview(true);
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
      );

      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? "Repository not found"
            : response.status === 403
              ? "Rate limit exceeded. Please try again later."
              : "Failed to fetch repository",
        );
      }

      const data = repoSchema.parse(await response.json());
      setPreview({
        name: data.name,
        description: data.description,
        owner: {
          login: data.owner.login,
          avatarUrl: data.owner.avatar_url,
        },
        private: data.private,
        stargazersCount: data.stargazers_count,
      });
      setError(null);
    } catch (error) {
      console.error("Preview fetch error:", error);
      setError(
        error instanceof Error ? error.message : "Failed to fetch repository",
      );
      setPreview(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const debouncedValidateAndPreview = useDebounce((input: string) => {
    const res = githubRepoFormSchema.safeParse({
      input,
    });
    if (res.success) {
      setError(null);
      const res = validateAndExtractGithubOwnerAndRepo(input);
      if (res) {
        void fetchPreview(res.owner, res.repo);
      }
    } else {
      const errors = res.error.errors.map((err) => err.message).join(", ");
      setError(errors ?? "Invalid repository format");
      setPreview(null);
    }
  }, 500);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <ShimmerButton
          variant="outline"
          size="sm"
          className="relative gap-2 border-2 border-blue-500/30 bg-gradient-to-r from-blue-500/30 to-orange-500/30 transition-all hover:border-blue-500/50 hover:from-blue-500/40 hover:to-orange-500/40 hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] dark:from-blue-400/30 dark:to-orange-400/30 dark:hover:from-blue-400/40 dark:hover:to-orange-400/40"
        >
          <PlusIcon className="size-4 text-blue-400" />
          <span className="font-medium">Get a badge for your repo now 🔍</span>
        </ShimmerButton>
      </DialogTrigger>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create a SemHub badge for your repo</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="rounded-xl border-2 bg-background p-1">
            <Input
              placeholder="org/repo or GitHub URL"
              value={repoInput}
              variant="url"
              className="border-0 bg-transparent px-3 text-base shadow-none"
              onChange={(e) => {
                const newValue = e.target.value;
                setRepoInput(newValue);
                debouncedValidateAndPreview(newValue);
              }}
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircleIcon className="size-4" />
              <span>{error}</span>
            </div>
          )}

          {isLoadingPreview && <RepoPreviewSkeleton />}

          {preview && !isLoadingPreview && (
            <div className="space-y-4">
              <RepoPreview
                name={preview.name}
                description={preview.description}
                owner={preview.owner}
                private={preview.private}
                stargazersCount={preview.stargazersCount}
              />
              <div className="flex h-12 items-center justify-center rounded-xl bg-background">
                <a href={`/r/${preview.owner.login}/${preview.name}`}>
                  <img src={SEMHUB_BADGE_IMG_SRC} alt="Search with SemHub" />
                </a>
              </div>
              <div className="flex h-12 items-center gap-3 rounded-xl border-2 bg-background px-4">
                <div className="w-0 flex-1 overflow-x-auto">
                  <pre className="inline-block">
                    <code className="text-sm">{embedCode}</code>
                  </pre>
                </div>
                <CopyButton copied={copied} onClick={copyToClipboard} />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

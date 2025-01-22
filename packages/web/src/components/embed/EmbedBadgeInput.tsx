import { AlertCircleIcon, CheckIcon, CopyIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { repoSchema } from "@/core/github/schema.rest";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  RepoPreview,
  RepoPreviewProps,
  RepoPreviewSkeleton,
} from "@/components/repos/RepoPreview";
import {
  githubRepoFormSchema,
  validateAndExtractGithubOwnerAndRepo,
} from "@/components/repos/subscribe";

export function EmbedBadgeInput() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [repoInput, setRepoInput] = useState("");
  const [preview, setPreview] = useState<RepoPreviewProps | null>(null);

  const imgSrc =
    "https://img.shields.io/badge/search-semhub-blue?style=flat&logo=https://semhub.dev/search-icon.svg";

  const embedCode = preview
    ? `<a href="https://semhub.dev/r/${preview.owner.login}/${preview.name}"><img src="${imgSrc}" alt="Search with SemHub"></a>`
    : "";

  const copyToClipboard = () => {
    if (!embedCode) return;
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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
        <Button variant="outline" size="sm" className="gap-2">
          <PlusIcon className="size-4" />
          <span>Embed</span>
        </Button>
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
                  <img src={imgSrc} alt="Search with SemHub" />
                </a>
              </div>
              <div className="flex h-12 items-center gap-3 rounded-xl border-2 bg-background px-4">
                <div className="w-0 flex-1 overflow-x-auto">
                  <pre className="inline-block">
                    <code className="text-sm">{embedCode}</code>
                  </pre>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={copyToClipboard}
                >
                  {copied ? (
                    <>
                      <CheckIcon className="size-3 text-green-500" />
                      <span className="text-xs">Copied!</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="size-3" />
                      <span className="text-xs">Copy</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { AlertCircleIcon, LoaderIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  RepoPreview,
  RepoPreviewData,
  RepoPreviewSkeleton,
  repoResponseSchema,
} from "@/components/RepoPreview";

const githubUrlSchema = z.object({
  owner: z.string(),
  repo: z.string(),
});

type RepoType = "public" | "private";

interface AddRepoModalProps {
  type: RepoType;
  onSubscribe: (type: RepoType, owner: string, repo: string) => Promise<void>;
}

export function AddRepoModal({ type, onSubscribe }: AddRepoModalProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preview, setPreview] = useState<RepoPreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const parsed = new URL(url);
      if (parsed.hostname !== "github.com") {
        throw new Error("Please enter a valid GitHub repository URL");
      }

      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length !== 2) {
        throw new Error("Invalid repository URL format");
      }

      const { owner, repo } = githubUrlSchema.parse({
        owner: parts[0],
        repo: parts[1],
      });

      await onSubscribe(type, owner, repo);
      setOpen(false);
      setUrl("");
      setPreview(null);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to subscribe to repository",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchPreview = async (owner: string, repo: string) => {
    try {
      setIsLoadingPreview(true);
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Repository not found");
        }
        if (response.status === 403) {
          throw new Error("Rate limit exceeded. Please try again later.");
        }
        throw new Error("Failed to fetch repository");
      }

      const data = await response.json();
      const validatedData = repoResponseSchema.parse(data);
      setPreview(validatedData);
      setError(null);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to fetch repository",
      );
      setPreview(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const debouncedValidateAndPreview = useDebounce((url: string) => {
    setError(null);
    try {
      const parsed = new URL(url);
      if (parsed.hostname !== "github.com") {
        return;
      }

      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length !== 2) {
        return;
      }

      const result = githubUrlSchema.safeParse({
        owner: parts[0],
        repo: parts[1],
      });

      if (result.success) {
        void fetchPreview(result.data.owner, result.data.repo);
      }
    } catch {
      setPreview(null);
    }
  }, 500);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          Subscribe <PlusIcon className="ml-2 size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            Add {type === "private" ? "Private" : "Public"} Repository
          </DialogTitle>
          <DialogDescription>
            Enter the URL of the GitHub repository you want to subscribe to.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Input
              placeholder="Enter GitHub repository URL"
              value={url}
              onChange={(e) => {
                const newValue = e.target.value;
                setUrl(newValue);
                debouncedValidateAndPreview(newValue);
              }}
            />
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircleIcon className="size-4" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {isLoadingPreview && <RepoPreviewSkeleton />}

          {preview && !isLoadingPreview && <RepoPreview data={preview} />}

          <DialogFooter>
            <Button
              type="submit"
              disabled={!url || isSubmitting || isLoadingPreview}
              className="w-full sm:w-auto"
            >
              {isSubmitting && (
                <LoaderIcon className="mr-2 size-4 animate-spin" />
              )}
              Add Repository
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { LoaderIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { repoSchema } from "@/core/github/schema.rest";
import { useSubscribeRepo } from "@/lib/hooks/useRepo";
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
  RepoPreviewSkeleton,
  type RepoPreviewProps,
} from "@/components/repos/RepoPreview";
import {
  githubUrlSchema,
  ValidationErrors,
} from "@/components/repos/validation";

export function SubscribePublicRepo() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<RepoPreviewProps | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const subscribeRepoMutation = useSubscribeRepo();
  const form = useForm({
    defaultValues: {
      url: "",
    },
    validatorAdapter: zodValidator(),
    validators: {
      onChange: githubUrlSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const { owner, repo } = githubUrlSchema.parse(value);
        await subscribeRepoMutation.mutateAsync({
          type: "public",
          owner,
          repo,
        });
        setOpen(false);
        setPreview(null);
        form.reset();
        return null;
      } catch (error) {
        return {
          onSubmit:
            error instanceof Error
              ? error.message
              : "Failed to subscribe to repository",
        };
      }
    },
  });

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
    const { success, data } = githubUrlSchema.safeParse({ url });
    if (success) {
      void fetchPreview(data.owner, data.repo);
    } else {
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
          <DialogTitle>Add Public Repository</DialogTitle>
          <DialogDescription>
            Enter the URL of the GitHub repository you want to subscribe to.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          className="grid gap-4"
        >
          <form.Field
            name="url"
            children={(field) => (
              <div className="grid gap-2">
                <Input
                  placeholder="Enter GitHub repository URL"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    field.handleChange(newValue);
                    debouncedValidateAndPreview(newValue);
                  }}
                />
                <ValidationErrors field={field} error={error} />
              </div>
            )}
          />

          {isLoadingPreview && <RepoPreviewSkeleton />}

          {preview && !isLoadingPreview && (
            <RepoPreview
              name={preview.name}
              description={preview.description}
              owner={preview.owner}
              private={preview.private}
              stargazersCount={preview.stargazersCount}
            />
          )}

          <form.Subscribe
            selector={(state) => [state.errorMap]}
            children={([errorMap]) =>
              errorMap?.onSubmit ? (
                <p className="text-[0.8rem] font-medium text-destructive">
                  {errorMap.onSubmit.toString()}
                </p>
              ) : null
            }
          />

          <DialogFooter>
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => {
                return (
                  <Button
                    type="submit"
                    disabled={!canSubmit || isLoadingPreview || !preview}
                    className="w-full sm:w-auto"
                  >
                    {isSubmitting && (
                      <LoaderIcon className="mr-2 size-4 animate-spin" />
                    )}
                    Add Repository
                  </Button>
                );
              }}
            />
          </DialogFooter>

          <form.Subscribe
            selector={(state) => [state.errorMap]}
            children={([errorMap]) =>
              errorMap?.onSubmit ? (
                <p className="text-sm text-destructive">
                  {errorMap.onSubmit?.toString()}
                </p>
              ) : null
            }
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

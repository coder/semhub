import { useForm, ValidationError } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
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

const githubUrlSchema = z
  .object({
    url: z.string().url("Please enter a valid URL"),
  })
  .refine(({ url }) => {
    try {
      const parsed = new URL(url);
      return (
        parsed.hostname === "github.com" &&
        parsed.pathname.split("/").filter(Boolean).length === 2
      );
    } catch {
      return false;
    }
  }, "Please enter a valid GitHub repository URL");

const githubUrlSchemaExtended = githubUrlSchema.transform(({ url }) => {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  return {
    owner: parts[0]!,
    repo: parts[1]!,
  };
});

type RepoType = "public" | "private";

interface SubscribeRepoDialogProps {
  type: RepoType;
  onSubscribe: (type: RepoType, owner: string, repo: string) => Promise<void>;
}

export function SubscribeRepoDialog({
  type,
  onSubscribe,
}: SubscribeRepoDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<RepoPreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const form = useForm({
    defaultValues: {
      url: "",
    },
    validatorAdapter: zodValidator(),
    validators: {
      onChange: githubUrlSchema,
    },
    onSubmit: async ({ value }) => {
      console.log("Form submitted with value:", value);
      try {
        const { owner, repo } = githubUrlSchemaExtended.parse(value);
        await onSubscribe(type, owner, repo);
        setOpen(false);
        setPreview(null);
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

  // can fetch preview from frontend for public repo
  // for private repo, must fetch from backend...
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

      setPreview(repoResponseSchema.parse(await response.json()));
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
    console.log("debouncedValidateAndPreview", url);
    setError(null);
    const { success, data } = githubUrlSchemaExtended.safeParse({ url });
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
          <DialogTitle>
            Add {type === "private" ? "Private" : "Public"} Repository
          </DialogTitle>
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
                <ValidationErrors
                  fieldErrors={field.state.meta.errors}
                  isTouched={field.state.meta.isTouched}
                  error={error}
                />
              </div>
            )}
          />

          {isLoadingPreview && <RepoPreviewSkeleton />}

          {preview && !isLoadingPreview && <RepoPreview data={preview} />}

          <form.Subscribe
            selector={(state) => [
              state.canSubmit,
              state.isSubmitting,
              state.isValidating,
              state.errors,
              state.values,
            ]}
            children={([
              canSubmit,
              isSubmitting,
              isValidating,
              errors,
              values,
              meta,
            ]) => {
              console.log("Detailed form state:", {
                canSubmit,
                isSubmitting,
                isValidating,
                errors,
                values,
                meta,
              });
              return null;
            }}
          />

          <DialogFooter>
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => {
                console.log("Form state:", { canSubmit, isSubmitting });
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

function ValidationErrors({
  fieldErrors,
  isTouched,
  error,
}: {
  fieldErrors: ValidationError[];
  isTouched: boolean;
  error: string | null;
}) {
  const validationError = isTouched
    ? fieldErrors
        .filter((err): err is string => typeof err === "string")
        .join(", ")
    : null;

  const displayError = validationError || error;

  return displayError ? (
    <div className="flex items-center gap-2 text-sm text-red-500">
      <AlertCircleIcon className="size-4" />
      <span>{displayError}</span>
    </div>
  ) : null;
}

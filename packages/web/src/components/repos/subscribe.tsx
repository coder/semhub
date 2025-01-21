import { type FieldApi } from "@tanstack/react-form";
import { AlertCircleIcon } from "lucide-react";
import { z } from "zod";

import { repoUserInputSchema } from "@/core/github/schema.validation";

// Shared error message
const INVALID_REPO_MESSAGE = "Please enter a valid GitHub repository";

// Utility function to extract owner and repo, with validation
const validateAndExtractGithubOwnerAndRepo = (
  input: string,
  ctx?: z.RefinementCtx,
) => {
  // Normalize the input to handle both URL and owner/repo format
  const normalizedInput = input.includes("github.com")
    ? new URL(
        input.startsWith("http") ? input : `https://${input}`,
      ).pathname.slice(1)
    : input;
  // Split and filter out empty strings
  const parts = normalizedInput.split("/").filter(Boolean);
  // Validate we have exactly owner and repo
  if (parts.length !== 2) {
    if (ctx) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: INVALID_REPO_MESSAGE,
      });
    }
    return null;
  }
  const [owner, repo] = parts;
  // Validate against schema
  const result = repoUserInputSchema.safeParse({ owner, repo });
  if (!result.success) {
    if (ctx) {
      result.error.errors.forEach((err) => ctx.addIssue(err));
    }
    return null;
  }

  return result.data;
};

// Schema for form validation (used by TanStack Form)
// need to maintain separate schema because transform is not supported
// https://github.com/TanStack/form/issues/418
export const githubRepoFormSchema = z.object({
  input: z.string().refine((val) => {
    return (
      val
        // adding these so validation doesn't kick in too early
        .replace("https://github.com/", "")
        .replace("www.github.com/", "")
        .replace("github.com/", "")
        .replace("github", "").length <= 5
        ? true
        : validateAndExtractGithubOwnerAndRepo(val) !== null
    );
  }, INVALID_REPO_MESSAGE),
});

// Schema for submission (with transform)
export const githubRepoSubmitSchema = z
  .object({
    input: z.string(),
  })
  .transform((data, ctx) => {
    const result = validateAndExtractGithubOwnerAndRepo(data.input, ctx);
    if (!result) return z.NEVER;
    return result;
  });

interface ValidationErrorsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field: FieldApi<any, any, any, any, any>;
  error: string | null;
}

export function ValidationErrors({ field, error }: ValidationErrorsProps) {
  const validationError =
    field.state.meta.isTouched && field.state.meta.errors.length
      ? field.state.meta.errors
          .filter((err: unknown): err is string => typeof err === "string")
          .join(", ")
      : null;

  const errors = [validationError, error].filter(Boolean);
  const displayError = errors.length > 0 ? errors.join(", ") : null;

  return displayError ? (
    <div className="flex items-center gap-2 text-sm text-red-500">
      <AlertCircleIcon className="size-4" />
      <span>{displayError}</span>
    </div>
  ) : null;
}

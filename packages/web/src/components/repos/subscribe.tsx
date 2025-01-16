import { type FieldApi } from "@tanstack/react-form";
import { AlertCircleIcon } from "lucide-react";
import { z } from "zod";

import { repoValidationSchema } from "@/core/github/schema.validation";

const extractOwnerAndRepo = (input: string, ctx: z.RefinementCtx) => {
  // Try parsing as URL first
  try {
    const url = input.startsWith("http") ? input : `https://${input}`;
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Not a GitHub URL",
      });
      return z.NEVER;
    }
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid repository path",
      });
      return z.NEVER;
    }
    return { owner: parts[0], repo: parts[1] };
  } catch {
    // If not a URL, try org/repo format
    const parts = input.split("/").filter(Boolean);
    if (parts.length !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Please enter a valid GitHub repository (e.g. 'org/repo' or 'github.com/org/repo')",
      });
      return z.NEVER;
    }
    return { owner: parts[0], repo: parts[1] };
  }
};

export const githubRepoSchema = z
  .object({
    input: z.string().min(1, "Please enter a repository"),
  })
  .transform((data, ctx) => {
    const result = extractOwnerAndRepo(data.input, ctx);
    if (result === z.NEVER) return z.NEVER;
    return result;
  })
  .pipe(repoValidationSchema);

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

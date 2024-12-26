import { type FieldApi } from "@tanstack/react-form";
import { AlertCircleIcon } from "lucide-react";
import { z } from "zod";

import { repoValidationSchema } from "@/core/github/schema.validation";

export const githubUrlSchema = z
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
  }, "Please enter a valid GitHub repository URL")
  .transform(({ url }) => {
    const parsedUrl = new URL(url);
    const parts = parsedUrl.pathname.split("/").filter(Boolean);
    const repoSubscribe = {
      owner: parts[0]!,
      repo: parts[1]!,
    };
    return repoValidationSchema.parse(repoSubscribe);
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

import { type FieldApi } from "@tanstack/react-form";
import { AlertCircleIcon } from "lucide-react";

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

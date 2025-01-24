import { AlertTriangleIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ValidationErrorAlert({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;

  return (
    <Alert
      variant="default"
      className="mt-4 flex flex-col items-start gap-1 border-orange-500 bg-orange-500/10 text-left"
    >
      <div className="flex items-center gap-2">
        <AlertTriangleIcon className="size-4 text-orange-500" />
        <AlertTitle className="text-orange-500">
          Search query contains {errors.length}{" "}
          {errors.length === 1 ? "error" : "errors"}
        </AlertTitle>
      </div>
      <AlertDescription className="w-full">
        <ul className="ml-6 list-disc space-y-1">
          {errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

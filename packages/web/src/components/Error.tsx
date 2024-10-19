import { useEffect } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";

import { AlertTriangleIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";

export function Error({ error }: { error: Error }) {
  const router = useRouter();
  const isDev = process.env.NODE_ENV !== "production";

  const queryClientErrorBoundary = useQueryErrorResetBoundary();

  useEffect(() => {
    queryClientErrorBoundary.reset();
  }, [queryClientErrorBoundary]);

  return (
    <div className="mt-8 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Alert variant="destructive">
          <AlertTriangleIcon className="size-4" />
          <AlertTitle>Sorry! Something went wrong</AlertTitle>
          <AlertDescription>
            We encountered an unexpected error.
          </AlertDescription>
        </Alert>

        <div className="mt-4 space-y-4">
          <Button
            className="w-full"
            onClick={() => {
              router.invalidate();
            }}
          >
            Try again
          </Button>
          <Button asChild className="w-full" variant="secondary">
            <Link to="/">Go home</Link>
          </Button>
          {isDev ? (
            <div className="rounded-md bg-muted p-4">
              <h3 className="mb-2 font-semibold">Error Message:</h3>
              <p className="mb-4 text-sm">{error.message}</p>
              <h3 className="mb-2 font-semibold">Stack Trace:</h3>
              <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
                {error.stack}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

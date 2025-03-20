import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export function NotFound() {
  return (
    <div className="flex size-full items-center justify-center p-2 text-2xl">
      <div className="flex flex-col items-center gap-4">
        <p className="text-4xl font-bold">404</p>
        <p className="text-lg">Page not found</p>
        <Button asChild className="w-full" variant="secondary">
          <Link to="/">Go Home</Link>
        </Button>
      </div>
    </div>
  );
}

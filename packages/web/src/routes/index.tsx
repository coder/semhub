import { createFileRoute } from "@tanstack/react-router";

import { FullSearch } from "@/components/FullSearch";

export const Route = createFileRoute("/")({
  component: FullSearch,
});

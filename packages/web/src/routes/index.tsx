import { createFileRoute } from "@tanstack/react-router";

import { HomepageSearch } from "@/components/HomepageSearch";

export const Route = createFileRoute("/")({
  component: HomepageSearch,
});

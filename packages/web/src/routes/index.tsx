import { createFileRoute } from "@tanstack/react-router";

import { HomepageSearch } from "@/components/search/HomepageSearch";

export const Route = createFileRoute("/")({
  component: HomepageSearch,
});

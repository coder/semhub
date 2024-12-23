import { QueryClient } from "@tanstack/react-query";

import type { SearchParams } from "@/routes/search";

export const queryKeys = {
  session: ["session"] as const,
  repos: {
    list: ["repos", "list"] as const,
  },
  issues: {
    search: (params: SearchParams) =>
      [
        "issues",
        "search",
        params.q,
        params.order,
        params.limit,
        params.page,
        params.lucky,
      ] as const,
  },
} as const;

export const queryClient = new QueryClient();

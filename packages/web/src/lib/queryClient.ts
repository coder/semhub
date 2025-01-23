import { QueryClient } from "@tanstack/react-query";

import type {
  MeSearchSchema,
  PublicSearchSchema,
} from "@/workers/server/router/schema/search.schema";

export const queryKeys = {
  session: ["session"] as const,
  repos: {
    list: ["repos", "list"] as const,
    status: (owner: string, repo: string) =>
      ["repos", "status", owner, repo] as const,
    get: (owner: string, repo: string) =>
      ["repos", "get", owner, repo] as const,
  },
  issues: {
    search: {
      public: (params: PublicSearchSchema) =>
        [
          "issues",
          "search",
          "public",
          params.q,
          params.order,
          params.limit,
          params.page,
          params.lucky,
        ] as const,
      me: (params: MeSearchSchema) =>
        [
          "issues",
          "search",
          "me",
          params.q,
          params.order,
          params.limit,
          params.page,
        ] as const,
    },
  },
  installation: {
    status: ["installation", "status"] as const,
  },
} as const;

export const queryClient = new QueryClient();

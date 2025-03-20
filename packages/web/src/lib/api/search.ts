import type { InferResponseType } from "hono/client";

import type {
  MeSearchSchema,
  PublicSearchSchema,
} from "@/workers/server/router/schema/search.schema";

import { client, handleResponse } from "./client";

export type PublicSearchIssuesResponse = InferResponseType<
  typeof client.public.search.$get
>;

export const publicSearchIssues = async ({
  query,
  pageParam,
  lucky,
}: {
  query: PublicSearchSchema["q"];
  pageParam?: PublicSearchSchema["page"];
  lucky: PublicSearchSchema["lucky"];
}) => {
  const res = await client.public.search.$get({
    query: {
      q: query,
      page: pageParam?.toString() ?? "1",
      lucky,
    },
  });
  return handleResponse(res, "Failed to search issues");
};

export const meSearchIssues = async ({
  query,
  pageParam,
}: {
  query: MeSearchSchema["q"];
  pageParam?: MeSearchSchema["page"];
}) => {
  const res = await client.me.search.$get({
    query: {
      q: query,
      page: pageParam?.toString() ?? "1",
    },
  });
  return handleResponse(res, "Failed to search issues");
};

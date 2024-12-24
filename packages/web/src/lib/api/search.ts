import type { InferResponseType } from "hono/client";

import type { IssuesSearchSchema } from "@/workers/server/router/schema/issue.schema";

import { client, handleResponse } from "./client";

export type SearchIssuesResponse = InferResponseType<
  typeof client.public.search.$get
>;

export const searchIssues = async ({
  query,
  pageParam,
  lucky,
}: {
  query: IssuesSearchSchema["q"];
  pageParam?: IssuesSearchSchema["page"];
  lucky: IssuesSearchSchema["lucky"];
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

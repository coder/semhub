import type { InferResponseType } from "hono/client";

import type { ErrorResponse } from "@/workers/server/response";
import { isErrorResponse } from "@/workers/server/response";
import type { IssuesSearchSchema } from "@/workers/server/router/schema";

import { client } from "./client";

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
  if (!res.ok) {
    const data = (await res.json()) as SearchIssuesResponse | ErrorResponse;
    if (isErrorResponse(data)) {
      throw new Error(data.error);
    }
    throw new Error("Unknown error");
  }

  const data = await res.json();
  return data;
};

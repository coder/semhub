import type { ApiRoutes } from "@/workers/server";
import type { ErrorResponse} from "@/workers/server/response";
import { isErrorResponse } from "@/workers/server/response";
import type { IssuesSearchSchema } from "@/workers/server/router/schema";
import { hc, type InferResponseType } from "hono/client";

const apiUrl = import.meta.env.VITE_API_URL;

const client = hc<ApiRoutes>(apiUrl, {
  // TODO: auth
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, {
      ...init,
      // credentials: "include",
      // redirect: "follow",
    }),
}).api;

export type SearchIssuesResponse = InferResponseType<typeof client.search.$get>;
export const searchIssues = async ({
  query,
  pageParam,
  lucky,
}: {
  query: IssuesSearchSchema["q"];
  pageParam?: IssuesSearchSchema["page"];
  lucky: IssuesSearchSchema["lucky"];
}) => {
  const res = await client.search.$get({
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

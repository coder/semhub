import type { Server } from "@semhub/core/server";
import { Response } from "@semhub/core/server/response";
import { hc, type InferResponseType } from "hono/client";

const client = hc<Server.ApiRoutes>("/", {
  // TODO: auth
  // fetch: (input: RequestInfo | URL, init?: RequestInit) =>
  //   fetch(input, {
  //     ...init,
  //     credentials: "include",
  //   }),
}).api;

export type SearchIssuesResponse = InferResponseType<typeof client.search.$get>;
export const searchIssues = async ({
  query,
  pageParam,
}: {
  query: string;
  pageParam?: number;
}) => {
  const res = await client.search.$get({
    query: {
      q: query,
      p: pageParam?.toString() ?? "1",
    },
  });
  if (!res.ok) {
    const data = (await res.json()) as
      | SearchIssuesResponse
      | Response.ErrorResponse;
    if (Response.isErrorResponse(data)) {
      throw new Error(data.error);
    }
    throw new Error("Unknown error");
  }

  const data = await res.json();

  return data;
};

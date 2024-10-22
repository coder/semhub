import { hc, type InferResponseType } from "hono/client";

import type { Router } from "@semhub/core/router";
import { RouterSchema } from "@semhub/core/router/schema";

const client = hc<Router.ApiRoutes>("/", {
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
      | RouterSchema.ErrorResponse;
    if (RouterSchema.isErrorResponse(data)) {
      throw new Error(data.error);
    }
    throw new Error("Unknown error");
  }

  const data = await res.json();

  return data;
};

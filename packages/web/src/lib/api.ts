import { hc, InferResponseType } from "hono/client";

import { type ApiRoutes } from "@semhub/core/router";

const client = hc<ApiRoutes>("/", {
  // TODO: auth
  // fetch: (input: RequestInfo | URL, init?: RequestInit) =>
  //   fetch(input, {
  //     ...init,
  //     credentials: "include",
  //   }),
}).api;

export const search = async ({ query }: { query: string }) => {
  const res = await client.search.$get({
    query: {
      q: query,
    },
  });
};

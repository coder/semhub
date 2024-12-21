import { hc } from "hono/client";

import type { ApiRoutes } from "@/workers/server";

const apiUrl = import.meta.env.VITE_API_URL;
// needed for CI to pass
if (!apiUrl) {
  throw new Error("VITE_API_URL is not set");
}

export const client = hc<ApiRoutes>(apiUrl, {
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, {
      ...init,
      credentials: "include",
      redirect: "follow",
    }),
}).api;

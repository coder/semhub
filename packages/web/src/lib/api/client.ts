import { hc } from "hono/client";
import type { ClientResponse } from "hono/client";

import type { ApiRoutes } from "@/workers/server/app";
import { isErrorResponse } from "@/workers/server/response";

const apiUrl = import.meta.env.VITE_API_URL;
// needed for CI to pass
if (!apiUrl) {
  throw new Error("VITE_API_URL is not set");
}

export async function handleResponse<R>(
  res: ClientResponse<R>,
  fallbackErrorMessage?: string,
): Promise<R> {
  if (!res.ok) {
    const data = await res.json();
    // redirect to homepage if 401
    if (res.status === 401) {
      window.location.href = "/";
    }
    if (isErrorResponse(data)) {
      throw new Error(data.error);
    }
    throw new Error(
      fallbackErrorMessage ?? `Unknown error occurred while calling ${res.url}`,
    );
  }
  return res.json() as Promise<R>;
}

export const client = hc<ApiRoutes>(apiUrl, {
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, {
      ...init,
      credentials: "include",
      redirect: "follow",
    }),
}).api;

import type { InferResponseType } from "hono/client";

import { queryClient, queryKeys } from "@/lib/queryClient";
import { storage } from "@/lib/storage";

import { client, handleResponse } from "./client";

// Add these type definitions
type SessionResponse = InferResponseType<typeof client.auth.$get>;
type NullableUserData = Extract<
  SessionResponse,
  { authenticated: true }
>["user"];
export type UserData = NonNullable<NullableUserData>;

// Add new function to handle session fetching
export async function fetchSession() {
  const res = await client.auth.$get();
  const data = await res.json();
  // Update localStorage with fresh data
  storage.setAuthStatus(data.authenticated);
  if (data.authenticated && data.user) {
    storage.setUserData(data.user);
  } else {
    storage.clearUserData();
  }

  return data;
}

export async function login() {
  const res = await client.auth.authorize.$get({
    query: {
      returnTo: window.location.origin + "/",
    },
  });
  const {
    data: { url },
  } = await handleResponse(res, "Failed to start authentication");
  window.location.href = url;
}

export async function logout() {
  // Clear storage first
  storage.clearAuthStatus();
  storage.clearUserData();

  // Immediately update query cache to trigger UI updates
  queryClient.setQueryData([queryKeys.session], {
    authenticated: false,
    user: null,
  });

  await client.auth.logout.$post();
  // Still invalidate to ensure fresh state
  await queryClient.invalidateQueries({ queryKey: [queryKeys.session] });
  window.location.href = "/";
}

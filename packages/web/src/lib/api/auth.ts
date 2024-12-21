import { queryClient, queryKeys } from "@/lib/queryClient";
import { storage } from "@/lib/storage";

import { client } from "./client";

export async function login() {
  const res = await client.auth.authorize.$get({
    query: {
      returnTo: window.location.origin + "/",
    },
  });
  if (!res.ok) {
    throw new Error("Failed to start auth flow");
  }
  const { authUrl } = await res.json();
  window.location.href = authUrl;
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

  const response = await client.auth.logout.$get({
    query: {
      returnTo: window.location.origin + "/",
    },
  });

  // Still invalidate to ensure fresh state
  await queryClient.invalidateQueries({ queryKey: [queryKeys.session] });
  return response;
}

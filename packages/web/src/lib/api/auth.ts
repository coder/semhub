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
  // Clear storage first for immediate UI update
  storage.clearAuthStatus();
  storage.clearUserData();

  const response = await client.auth.logout.$get({
    query: {
      returnTo: window.location.origin + "/",
    },
  });
  await queryClient.invalidateQueries({ queryKey: [queryKeys.session] });
  return response;
}

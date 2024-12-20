import { storage } from "../storage";
import { client } from "./client";

export async function login() {
  const res = await client.auth.authorize.$get({
    query: {
      returnTo: window.location.origin + "/",
    },
  });
  if (!res.ok) {
    storage.setAuthStatus(false);
    throw new Error("Failed to start auth flow");
  }
  const { authUrl } = await res.json();
  storage.setAuthStatus(true);
  window.location.href = authUrl;
}

export async function logout() {
  await client.auth.logout.$get({
    query: {
      returnTo: window.location.origin + "/",
    },
  });
  storage.setAuthStatus(false);
}

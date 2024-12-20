import { client } from "./client";

export async function login() {
  const res = await client.auth.authorize.$get({
    query: {
      // page to return to after auth
      returnTo: window.location.origin + "/",
    },
  });
  if (!res.ok) {
    throw new Error("Failed to start auth flow");
  }
  const { authUrl } = await res.json();
  console.log("authUrl", authUrl);
  window.location.href = authUrl;
}

export async function logout() {
  await client.auth.logout.$get({
    query: {
      returnTo: window.location.origin + "/",
    },
  });
}

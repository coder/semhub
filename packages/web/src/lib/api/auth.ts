import { client } from "./client";

export async function login() {
  const res = await client.auth.authorize.$get();
  if (!res.ok) {
    throw new Error("Failed to start auth flow");
  }
  return res.url;
}

export async function logout() {
  await client.auth.logout.$get();
  window.location.href = "/";
}

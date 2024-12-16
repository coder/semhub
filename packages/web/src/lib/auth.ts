import { createClient } from "@openauthjs/openauth/client";

const clientID = import.meta.env.VITE_SEMHUB_CLIENT_ID;
if (!clientID) {
  throw new Error("VITE_SEMHUB_CLIENT_ID is not set");
}

const authUrl = import.meta.env.VITE_AUTH_URL;
if (!authUrl) {
  throw new Error("VITE_AUTH_URL is not set");
}

export const authClient = createClient({
  clientID,
  issuer: authUrl,
});

let _access: string | undefined;

export async function getToken() {
  const refresh = localStorage.getItem("refresh");
  if (!refresh) return;
  const next = await authClient.refresh(refresh, {
    access: _access,
  });
  if (next.err) return;
  if (!next.tokens) return _access;
  localStorage.setItem("refresh", next.tokens.refresh);
  _access = next.tokens.access;
  return _access;
}

export async function handleCallback() {
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  const state = params.get("state");
  const challengeStr = sessionStorage.getItem("challenge");

  if (!code || !challengeStr) return;

  const challenge = JSON.parse(challengeStr);
  if (state === challenge.state && challenge.verifier) {
    const exchanged = await authClient.exchange(
      code,
      location.origin,
      challenge.verifier,
    );
    if (!exchanged.err) {
      _access = exchanged.tokens?.access;
      localStorage.setItem("refresh", exchanged.tokens.refresh);
      // Clean up
      sessionStorage.removeItem("challenge");
      // Remove query params
      window.history.replaceState({}, "", "/");
      return true;
    }
  }
  return false;
}

export function isAuthenticated() {
  return !!localStorage.getItem("refresh");
}

export function logout() {
  localStorage.removeItem("refresh");
  _access = undefined;
}

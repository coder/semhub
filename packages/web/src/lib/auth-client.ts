import { createAuthClient } from "better-auth/react";

const apiUrl = import.meta.env.VITE_API_URL;
// needed for CI to pass
if (!apiUrl) {
  throw new Error("VITE_API_URL is not set");
}

export const authClient = createAuthClient({
  baseURL: apiUrl,
});

export const { signIn, signUp, useSession } = authClient;

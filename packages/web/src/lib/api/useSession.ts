import { useQuery } from "@tanstack/react-query";

import { client } from "./client";

export function useSession() {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await client.auth.$get();
      if (!res.ok) {
        throw new Error("Failed to fetch session");
      }
      return res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });
  if (!data || error) {
    return {
      isAuthenticated: false,
      userEmail: null,
      error: error?.message || "Failed to fetch session",
      isLoading,
      refresh: refetch,
    };
  }

  return {
    isAuthenticated: data.authenticated,
    userEmail: data.authenticated ? data.userEmail : null,
    error: null,
    isLoading,
    refresh: refetch,
  };
}

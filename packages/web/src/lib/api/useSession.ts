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
  if (error || !data) {
    return {
      isAuthenticated: false,
      user: null,
      message: error?.message || "Failed to fetch session",
      isLoading,
      refresh: refetch,
    };
  }
  if (!data.authenticated) {
    return {
      isAuthenticated: false,
      user: null,
      message: data.message || "Failed to fetch session",
      isLoading,
      refresh: refetch,
    };
  }
  return {
    isAuthenticated: true,
    user: data.user,
    message: null,
    isLoading,
    refresh: refetch,
  };
}

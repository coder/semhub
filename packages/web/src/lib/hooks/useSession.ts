import { useQuery } from "@tanstack/react-query";

import { client } from "../api/client";
import { queryKeys } from "../queryClient";
import { storage } from "../storage";

export function useSession() {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: [queryKeys.session],
    queryFn: async () => {
      const res = await client.auth.$get();
      if (!res.ok) {
        storage.setAuthStatus(false);
        throw new Error("Failed to fetch session");
      }
      const data = await res.json();
      storage.setAuthStatus(data.authenticated);
      return data;
    },
    enabled: storage.getAuthStatus(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  if (!storage.getAuthStatus()) {
    return {
      isAuthenticated: false,
      user: null,
      message: null,
      isLoading: false,
      refresh: refetch,
    };
  }

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

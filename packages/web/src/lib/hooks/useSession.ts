import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { client } from "../api/client";
import { queryKeys } from "../queryClient";
import { storage } from "../storage";

export function useSession() {
  // Initialize with cached values
  const [localAuth, setLocalAuth] = useState(() => ({
    isAuthenticated: storage.getAuthStatus(),
    user: storage.getUserData(),
  }));

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: [queryKeys.session],
    queryFn: async () => {
      const res = await client.auth.$get();
      if (!res.ok) {
        throw new Error("Failed to fetch session");
      }
      const data = await res.json();

      // Update localStorage with fresh data
      storage.setAuthStatus(data.authenticated);
      if (data.authenticated && data.user) {
        storage.setUserData(data.user);
      } else {
        storage.clearUserData();
      }

      return data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Update local state when query data changes
  useEffect(() => {
    if (data) {
      setLocalAuth({
        isAuthenticated: data.authenticated,
        user: data.authenticated ? data.user : null,
      });
    }
  }, [data]);

  if (error) {
    return {
      isAuthenticated: false,
      user: null,
      message: error.message,
      isLoading,
      refresh: refetch,
    };
  }

  // Return local state instead of derived state
  return {
    isAuthenticated: localAuth.isAuthenticated,
    user: localAuth.user,
    message: null,
    isLoading,
    refresh: refetch,
  };
}

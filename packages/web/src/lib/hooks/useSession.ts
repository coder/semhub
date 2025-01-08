import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { fetchSession } from "../api/auth";
import { queryKeys } from "../queryClient";
import { storage } from "../storage";

export function useSession() {
  const [localAuth, setLocalAuth] = useState(() => ({
    isAuthenticated: storage.getAuthStatus(),
    user: storage.getUserData(),
  }));

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: [queryKeys.session],
    queryFn: fetchSession,
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

  const { isAuthenticated, user } = localAuth;
  if (error || !isAuthenticated || !user) {
    return {
      isAuthenticated: false,
      user: null,
      message: error?.message ?? "Not authenticated",
      isLoading,
      refresh: refetch,
    } as const;
  }

  return {
    isAuthenticated,
    user,
    message: null,
    isLoading,
    refresh: refetch,
  } as const;
}

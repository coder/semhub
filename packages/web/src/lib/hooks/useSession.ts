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

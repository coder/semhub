import { useSuspenseQuery } from "@tanstack/react-query";

import { getInstallationStatus } from "@/lib/api/installation";
import { queryKeys } from "@/lib/queryClient";

const VALID_INSTALLATION_INTERVAL = 1000 * 60 * 5; // 5 minutes
const INVALID_INSTALLATION_INTERVAL = 1000 * 5; // 5 seconds

export function useInstallationStatus() {
  return useSuspenseQuery({
    queryKey: queryKeys.installation.status,
    queryFn: getInstallationStatus,
    refetchInterval: (query) =>
      query.state.data?.hasValidInstallation
        ? VALID_INSTALLATION_INTERVAL
        : INVALID_INSTALLATION_INTERVAL,
  });
}

import { client, handleResponse } from "./client";

export interface InstallationStatus {
  hasValidInstallation: boolean;
}

export const getInstallationStatus = async () => {
  const response = await client.me.installations.status.$get();
  const { data } = await handleResponse(
    response,
    "Failed to check installation status",
  );
  return data;
};

import { client, handleResponse } from "./client";

export const authorizePrivateRepos = async () => {
  const res = await client.authz.authorize.$get({
    query: {
      returnTo: window.location.href,
    },
  });
  const {
    data: { url },
  } = await handleResponse(res, "Failed to start GitHub App installation");
  window.open(url, "_blank");
};

import { type InferResponseType } from "hono/client";

import { client, handleResponse } from "./client";

export const listRepos = async () => {
  const response = await client.me.repos.list.$get();
  const { data } = await handleResponse(
    response,
    "Failed to fetch repositories",
  );
  return data;
};

export const subscribeRepo = async (
  type: "public" | "private",
  owner: string,
  repo: string,
) => {
  const response = await client.me.repos.subscribe[type].$post({
    json: { owner, repo },
  });
  return handleResponse(response, `Failed to subscribe to ${owner}/${repo}`);
};

export const unsubscribeRepo = async (repoId: string) => {
  const response = await client.me.repos.unsubscribe[":repoId"].$post({
    param: { repoId },
  });
  return handleResponse(response, "Failed to unsubscribe from repository");
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const $get = client.public.repo[":owner"][":repo"].status.$get;
type RepoStatusResponse = InferResponseType<typeof $get>;

export async function getRepoStatus(owner: string, repo: string) {
  const res = await client.public.repo[":owner"][":repo"].status.$get({
    param: { owner, repo },
  });

  const { data } = await handleResponse<RepoStatusResponse>(
    res,
    "Failed to get repository status",
  );
  return data;
}

export async function getRepo(owner: string, repo: string) {
  const response = await client.public.repo[":owner"][":repo"].$get({
    param: { owner, repo },
  });
  return handleResponse(response, "Failed to get repository");
}

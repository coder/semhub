import type { InferResponseType } from "hono/client";

import { client } from "./client";

export const listRepos = async () => {
  const response = await client.me.repos.list.$get();
  const res = await response.json();
  if (!res.success) {
    throw new Error(res.error);
  }
  return res.data;
};

export type ListReposResponse = InferResponseType<
  typeof client.me.repos.list.$get
>;

export const subscribeRepo = async (
  type: "public" | "private",
  owner: string,
  repo: string,
) => {
  const response = await client.me.repos.subscribe[type].$post({
    json: { owner, repo },
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error);
  }
  return data;
};

export type SubscribeRepoResponse = InferResponseType<
  typeof client.me.repos.subscribe.public.$post
>;

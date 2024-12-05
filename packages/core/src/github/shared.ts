import { paginateGraphQL } from "@octokit/plugin-paginate-graphql";
import { Octokit } from "octokit";

const OctokitWithGraphqlPaginate = Octokit.plugin(paginateGraphQL);

export function getRestOctokit(githubPersonalAccessToken: string) {
  return new Octokit({
    auth: githubPersonalAccessToken,
  });
}

export type RestOctokit = ReturnType<typeof getRestOctokit>;

export function getGraphqlOctokit(githubPersonalAccessToken: string) {
  return new OctokitWithGraphqlPaginate({
    auth: githubPersonalAccessToken,
  });
}

export type GraphqlOctokit = ReturnType<typeof getGraphqlOctokit>;

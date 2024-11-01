import { paginateGraphQL } from "@octokit/plugin-paginate-graphql";
import { Octokit } from "octokit";
import { Resource } from "sst";

const OctokitWithGraphqlPaginate = Octokit.plugin(paginateGraphQL);

export function getRestOctokit() {
  const token = Resource.GITHUB_PERSONAL_ACCESS_TOKEN.value;
  return new Octokit({
    auth: token,
  });
}

export function getGraphqlOctokit() {
  const token = Resource.GITHUB_PERSONAL_ACCESS_TOKEN.value;
  return new OctokitWithGraphqlPaginate({
    auth: token,
  });
}

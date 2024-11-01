import { paginateGraphQL } from "@octokit/plugin-paginate-graphql";
import { Octokit } from "octokit";
import { Resource } from "sst";

const OctokitWithGraphQLPaginate = Octokit.plugin(paginateGraphQL);

export function getRestOctokit() {
  const token = Resource.GITHUB_PERSONAL_ACCESS_TOKEN.value;
  return new Octokit({
    auth: token,
  });
}

export function getGraphQLOctokit() {
  const token = Resource.GITHUB_PERSONAL_ACCESS_TOKEN.value;
  return new OctokitWithGraphQLPaginate({
    auth: token,
  });
}

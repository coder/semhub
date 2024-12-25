import type { AppAuthentication, AppAuthOptions } from "@octokit/auth-app";
import { createAppAuth } from "@octokit/auth-app";
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

export type AppAuthOctokit = AuthInterface;

export const getAppAuthOctokit = ({
  githubAppId,
  githubAppPrivateKey,
  githubAppClientId,
  githubAppClientSecret,
}: {
  githubAppId: string;
  githubAppPrivateKey: string;
  githubAppClientId: string;
  githubAppClientSecret: string;
}): AppAuthOctokit => {
  return createAppAuth({
    appId: githubAppId,
    privateKey: githubAppPrivateKey,
    clientId: githubAppClientId,
    clientSecret: githubAppClientSecret,
  });
};

// need to re-export this type from @octokit/auth-app to quell type errors
export interface AuthInterface {
  (options: AppAuthOptions): Promise<AppAuthentication>;
}

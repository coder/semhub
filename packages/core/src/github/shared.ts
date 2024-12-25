import type { AppAuthentication, AppAuthOptions } from "@octokit/auth-app";
import { createAppAuth } from "@octokit/auth-app";
import { paginateGraphQL } from "@octokit/plugin-paginate-graphql";
import { Octokit } from "octokit";

const OctokitWithGraphqlPaginate = Octokit.plugin(paginateGraphQL);

type OctokitAuthOptions =
  | { type: "token"; token: string }
  | {
      type: "app";
      appId: string | number;
      privateKey: string;
      installationId: number;
    };

export function getRestOctokit(auth: OctokitAuthOptions) {
  if (auth.type === "token") {
    return new Octokit({
      auth: auth.token,
    });
  }

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: auth.appId,
      privateKey: auth.privateKey,
      installationId: auth.installationId,
    },
  });
}

export type RestOctokit = ReturnType<typeof getRestOctokit>;

export function getGraphqlOctokit(auth: OctokitAuthOptions) {
  if (auth.type === "token") {
    return new OctokitWithGraphqlPaginate({
      auth: auth.token,
    });
  }

  return new OctokitWithGraphqlPaginate({
    authStrategy: createAppAuth,
    auth: {
      appId: auth.appId,
      privateKey: auth.privateKey,
      installationId: auth.installationId,
    },
  });
}

export type GraphqlOctokit = ReturnType<typeof getGraphqlOctokit>;

export type AppAuth = AuthInterface;

export const getAppAuth = ({
  githubAppId,
  githubAppPrivateKey,
  githubAppClientId,
  githubAppClientSecret,
}: {
  githubAppId: string;
  githubAppPrivateKey: string;
  githubAppClientId: string;
  githubAppClientSecret: string;
}): AppAuth => {
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

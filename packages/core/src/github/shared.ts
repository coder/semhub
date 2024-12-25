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
      githubInstallationId: number;
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
      installationId: auth.githubInstallationId,
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
      installationId: auth.githubInstallationId,
    },
  });
}

export type GraphqlOctokit = ReturnType<typeof getGraphqlOctokit>;

export const createGraphqlOctokitAppFactory = (
  appId: string | number,
  privateKey: string,
) => {
  return (githubInstallationId: number) => {
    return new OctokitWithGraphqlPaginate({
      authStrategy: createAppAuth,
      auth: {
        appId,
        privateKey,
        installationId: githubInstallationId,
      },
    });
  };
};

export const createRestOctokitAppFactory = (
  appId: string | number,
  privateKey: string,
) => {
  return (githubInstallationId: number) => {
    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId,
        privateKey,
        installationId: githubInstallationId,
      },
    });
  };
};

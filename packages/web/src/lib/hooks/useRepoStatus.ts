import { useQuery } from "@tanstack/react-query";

import { repoSchema } from "@/core/github/schema.rest";
import { getRepo } from "@/lib/api/repo";
import { queryKeys } from "@/lib/queryClient";
import type { RepoPreviewProps } from "@/components/repos/RepoPreview";

export type RepoStatus =
  | "not_found"
  | "initializing"
  | "error"
  | "loaded"
  | "on_github"
  | null;

type UseRepoStatusResult = {
  repoStatus: RepoStatus;
  error: string | null;
  preview: RepoPreviewProps | null;
  isLoading: boolean;
};

export function useRepoStatus(
  owner: string | null,
  repo: string | null,
): UseRepoStatusResult {
  const { data: repoPreviewData, isLoading } = useQuery({
    queryKey: queryKeys.repos.get(owner ?? "", repo ?? ""),
    queryFn: async () => {
      if (!owner || !repo) {
        return null;
      }

      const { data: repoResponse } = await getRepo(owner, repo);

      if (!repoResponse.exists) {
        return { status: "not_found" } as const;
      }

      if (repoResponse.hasLoaded) {
        const { initStatus } = repoResponse;
        switch (initStatus) {
          case "pending":
            return { status: "not_found" } as const;
          case "completed":
            return { status: "loaded" } as const;
          case "in_progress":
          case "ready":
            return { status: "initializing" } as const;
          case "error":
          case "no_issues":
            return { status: "error" } as const;
        }
      }

      // Repo exists on GitHub but not in our system
      const githubResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
      );

      if (!githubResponse.ok) {
        const error =
          githubResponse.status === 404
            ? "This repo does not exist on GitHub"
            : githubResponse.status === 403
              ? "This repo is on GitHub but rate limit is reached"
              : "Unknown error: failed to fetch repository";

        return {
          status: "on_github",
          error,
          preview: null,
        } as const;
      }

      const data = repoSchema.parse(await githubResponse.json());
      const preview: RepoPreviewProps = {
        name: data.name,
        description: data.description,
        owner: {
          login: data.owner.login,
          avatarUrl: data.owner.avatar_url,
        },
        private: data.private,
        stargazersCount: data.stargazers_count,
      };

      return {
        status: "on_github",
        error: null,
        preview,
      } as const;
    },
    enabled: !!owner && !!repo,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  if (!repoPreviewData) {
    return {
      repoStatus: null,
      error: null,
      preview: null,
      isLoading,
    } as const;
  }

  if (repoPreviewData.status === "on_github") {
    return {
      repoStatus: repoPreviewData.status,
      error: repoPreviewData.error,
      preview: repoPreviewData.preview,
      isLoading,
    };
  }
  return {
    repoStatus: repoPreviewData.status,
    error: null,
    preview: null,
    isLoading,
  };
}

import {
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { produce } from "immer";

import { ApiError } from "@/lib/api/client";
import {
  getRepoStatus,
  listRepos,
  subscribeRepo,
  unsubscribeRepo,
} from "@/lib/api/repo";
import { queryKeys } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useReposList() {
  return useSuspenseQuery({
    queryKey: queryKeys.repos.list,
    queryFn: listRepos,
    refetchInterval: 1000 * 30, // 30 seconds
  });
}

export type Repo = NonNullable<ReturnType<typeof useReposList>["data"]>[number];
export type RepoType = "public" | "private";

export const useSubscribeRepo = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      type,
      owner,
      repo,
    }: {
      type: RepoType;
      owner: string;
      repo: string;
    }) => subscribeRepo(type, owner, repo),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repos.list });
      toast({
        title: "Repository subscribed successfully",
        description: data.message,
      });
    },
    onError: (error) => {
      console.error("Failed to subscribe to repository:", error);
      toast({
        title: "Failed to subscribe to repository",
        variant: "destructive",
        description: error.message,
      });
    },
  });
};

export const useUnsubscribeRepo = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (repoId: string) => unsubscribeRepo(repoId),
    onMutate: async (repoId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.repos.list });

      // Snapshot the previous value
      const previousRepos = queryClient.getQueryData<Repo[]>(
        queryKeys.repos.list,
      );

      // Optimistically update to the new value
      queryClient.setQueryData<Repo[]>(
        queryKeys.repos.list,
        produce((old) => {
          if (!old) return [];
          return old.filter((repo) => repo.id !== repoId);
        }),
      );

      return { previousRepos };
    },
    onError: (error, _, context) => {
      // Rollback to the previous value on error
      queryClient.setQueryData(queryKeys.repos.list, context?.previousRepos);
      console.error("Failed to unsubscribe from repository:", error);
      toast({
        title: "Failed to unsubscribe from repository",
        variant: "destructive",
        description: error.message,
      });
    },
    onSuccess: () => {
      toast({
        title: "Repository unsubscribed successfully",
      });
    },
    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repos.list });
    },
  });
};

const LOADING_INTERVAL = 1000 * 30; // 30 seconds

export const getRepoStatusQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: queryKeys.repos.status(owner, repo),
    queryFn: () => getRepoStatus(owner, repo),
    refetchInterval: (query) => {
      const initStatus = query.state.data?.initStatus;
      if (initStatus === "in_progress" || initStatus === "ready") {
        return LOADING_INTERVAL;
      }
      return false;
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.code === 404) {
        return false;
      }
      return failureCount < 3;
    },
  });

export const useRepoStatus = (owner: string, repo: string) => {
  return useSuspenseQuery(getRepoStatusQueryOptions(owner, repo));
};

export type RepoStatusData = ReturnType<typeof useRepoStatus>["data"];

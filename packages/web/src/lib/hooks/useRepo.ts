import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { produce } from "immer";

import { listRepos, subscribeRepo, unsubscribeRepo } from "@/lib/api/repo";
import { queryKeys } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useReposQuery() {
  return useSuspenseQuery({
    queryKey: queryKeys.repos.list,
    queryFn: listRepos,
    refetchInterval: 1000 * 60 * 5, // 5 minutes, trivial to change
  });
}

export type Repo = NonNullable<
  ReturnType<typeof useReposQuery>["data"]
>[number];
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

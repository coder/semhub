import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";

import { listRepos, subscribeRepo } from "@/lib/api/repo";
import { queryKeys } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useReposQuery() {
  return useSuspenseQuery({
    queryKey: queryKeys.repos.list,
    queryFn: listRepos,
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

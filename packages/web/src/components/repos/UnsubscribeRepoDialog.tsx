import { LoaderIcon, UserXIcon } from "lucide-react";
import { useState } from "react";

import type { Repo } from "@/lib/hooks/useRepo";
import { useUnsubscribeRepo } from "@/lib/hooks/useRepo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface UnsubscribeRepoDialogProps {
  repo: Repo;
}

export function UnsubscribeRepoDialog({ repo }: UnsubscribeRepoDialogProps) {
  const [open, setOpen] = useState(false);
  const unsubscribe = useUnsubscribeRepo();

  const handleUnsubscribe = async () => {
    await unsubscribe.mutateAsync(repo.id);
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-destructive/10 hover:text-destructive"
        >
          <UserXIcon className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsubscribe from repository?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to unsubscribe from {repo.ownerName}/
            {repo.name}? You can always subscribe again later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleUnsubscribe}
            disabled={unsubscribe.isPending}
          >
            {unsubscribe.isPending && (
              <LoaderIcon className="mr-2 size-4 animate-spin" />
            )}
            Unsubscribe
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

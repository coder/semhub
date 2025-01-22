import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  CopyButton,
  getEmbedCode,
  SEMHUB_BADGE_IMG_SRC,
  useCopyToClipboard,
} from "./embed";

export function EmbedBadgePopover({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  const embedCode = getEmbedCode(owner, repo);
  const { copied, copyToClipboard } = useCopyToClipboard(embedCode);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <PlusIcon className="size-4" />
          <span>Embed</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Add SemHub to your repo</div>
            <p className="text-sm text-muted-foreground">
              Add semantic search to your repository by embedding this badge in
              your README and loading your repo into SemHub.{" "}
              <Link to="/r/your/repo" className="text-blue-500 underline">
                Learn more
              </Link>
            </p>
            <div className="flex items-center justify-center rounded border bg-muted/30 p-3">
              <a href={`/r/${owner}/${repo}`}>
                <img src={SEMHUB_BADGE_IMG_SRC} alt="Search with SemHub" />
              </a>
            </div>
            <div className="relative">
              <div className="flex items-center gap-2 rounded border bg-muted/50 p-3">
                <pre className="flex-1 overflow-x-auto text-xs">
                  <code>{embedCode}</code>
                </pre>
                <CopyButton copied={copied} onClick={copyToClipboard} />
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

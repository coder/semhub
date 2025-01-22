import { CheckIcon, CopyIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function EmbedBadgePopover({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  const [copied, setCopied] = useState(false);

  const imgSrc =
    "https://img.shields.io/badge/search-semhub-blue?style=flat&logo=https://semhub.dev/search-icon.svg";

  const embedCode = `<a href="https://semhub.dev/r/${owner}/${repo}"><img src="${imgSrc}" alt="Search with SemHub"></a>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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
              your README and loading your repo into SemHub.
            </p>
            <div className="flex items-center justify-center rounded border bg-muted/30 p-3">
              <a href={`/r/${owner}/${repo}`}>
                <img src={imgSrc} alt="Search with SemHub" />
              </a>
            </div>
            <div className="relative">
              <div className="flex items-center gap-2 rounded border bg-muted/50 p-3">
                <pre className="flex-1 overflow-x-auto text-xs">
                  <code>{embedCode}</code>
                </pre>
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={copyToClipboard}
                >
                  {copied ? (
                    <>
                      <CheckIcon className="size-3 text-green-500" />
                      <span className="text-xs">Copied!</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="size-3" />
                      <span className="text-xs">Copy</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

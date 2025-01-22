import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmbedBadgeInput } from "@/components/embed/EmbedBadgeInput";

export const Route = createFileRoute("/r/your/repo")({
  component: YourRepoPage,
});

function YourRepoPage() {
  return (
    <div className="relative flex w-full justify-center pt-28">
      <div className="w-full max-w-screen-xl px-4">
        <div className="mb-12 flex flex-col items-center text-center">
          <h1 className="mb-8 font-serif text-4xl tracking-tight">
            Add <span className="text-blue-600 dark:text-blue-500">Sem</span>
            antic search to your Git<span className="text-orange-500">
              Hub
            </span>{" "}
            repo
          </h1>

          <div className="mb-8 flex flex-col items-center gap-6">
            <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-6">
              <h2 className="font-serif text-2xl">
                Give{" "}
                <span className="text-blue-600 dark:text-blue-500">Sem</span>
                <span className="text-orange-500">Hub</span> a try
              </h2>
              <ul className="flex flex-col gap-3 text-left text-muted-foreground">
                <li className="flex items-center gap-3">
                  <div className="size-1.5 rounded-full bg-blue-600/40" />
                  <span>
                    Help users find answers faster with semantic search
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="size-1.5 rounded-full bg-blue-600/40" />
                  <span>
                    Reduce duplicate issues by making existing ones discoverable
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="size-1.5 rounded-full bg-blue-600/40" />
                  <span>Simple setup - just add a badge to your README</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="size-1.5 rounded-full bg-blue-600/20" />
                  <span className="[word-break:break-word]">
                    Search across pull requests and discussions
                    <Badge variant="coming-soon" className="ml-2">
                      Coming soon
                    </Badge>
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="size-1.5 rounded-full bg-blue-600/20" />
                  <span className="[word-break:break-word]">
                    Search across a collection of multiple repos, including
                    private repos
                    <Badge variant="coming-soon" className="ml-2">
                      Coming soon
                    </Badge>
                  </span>
                </li>
              </ul>
            </div>

            <div className="flex items-center gap-4">
              <EmbedBadgeInput />
            </div>

            <div className="flex flex-col items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Examples of repo-specific search:
              </span>
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  variant="outline"
                  className="inline-flex h-auto items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                  asChild
                >
                  <a
                    href="/r/ghostty-org/ghostty"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2"
                  >
                    <span>ghostty-org/ghostty</span>
                    <ArrowUpRightIcon className="size-3.5 opacity-50 transition-opacity group-hover:opacity-100" />
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className="inline-flex h-auto items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                  asChild
                >
                  <a
                    href="/r/coder/coder"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2"
                  >
                    <span>coder/coder</span>
                    <ArrowUpRightIcon className="size-3.5 opacity-50 transition-opacity group-hover:opacity-100" />
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className="inline-flex h-auto items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                  asChild
                >
                  <a
                    href="/r/microsoft/TypeScript"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2"
                  >
                    <span>microsoft/TypeScript</span>
                    <ArrowUpRightIcon className="size-3.5 opacity-50 transition-opacity group-hover:opacity-100" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

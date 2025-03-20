import { ArrowUpRightIcon } from "lucide-react";
import { useMemo } from "react";

import { getRandomItems } from "@/core/util/random";
import { useOperatorHighlighting } from "@/hooks/useOperatorHighlighting";
import { usePublicSearch } from "@/hooks/usePublicSearch";
import { Button } from "@/components/ui/button";

const ALL_SUGGESTED_SEARCHES = [
  // Editor related
  'repo:microsoft/vscode label:"good first issue" ',
  "repo:getcursor/cursor memory leak",
  // Terminal related
  'repo:ghostty-org/ghostty author:mitchellh label:"gui"',
  "repo:neovim/neovim language server protocol",
  // Frontend frameworks
  "repo:vuejs/core composition api",
  // Programming languages
  'repo:rust-lang/rust title:"lifetime"',
  "repo:golang/go concurrency",
  // org queries
  "org:vercel command line",
  "org:microsoft devtools",
] as const;

interface SuggestedSearchCardProps {
  search: string;
}

export function SuggestedSearchCard({ search }: SuggestedSearchCardProps) {
  const { handleSearch } = usePublicSearch({ mode: "suggested" });
  const highlightedParts = useOperatorHighlighting(search);

  return (
    <Button
      variant="outline"
      className="group w-full justify-between px-4 py-6 text-left hover:bg-muted/50"
      onClick={(e) => handleSearch(e, search)}
    >
      <span className="whitespace-pre-wrap break-words leading-relaxed">
        {highlightedParts.map((part, i) => (
          <span
            key={i}
            className={
              part.type === "operator"
                ? "text-blue-800 dark:text-blue-200"
                : part.type === "value"
                  ? "text-amber-800 dark:text-amber-200"
                  : undefined
            }
          >
            {part.text}
          </span>
        ))}
      </span>
      <ArrowUpRightIcon className="ml-2 size-4 shrink-0 opacity-50 transition-opacity group-hover:opacity-100" />
    </Button>
  );
}

export function useRandomSuggestions(count: number = 4) {
  return useMemo(() => getRandomItems(ALL_SUGGESTED_SEARCHES, count), [count]);
}

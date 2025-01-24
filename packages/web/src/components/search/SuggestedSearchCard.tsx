import { ArrowUpRightIcon } from "lucide-react";
import { useMemo } from "react";

import { getRandomItems } from "@/core/util/random";
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

  return (
    <Button
      variant="outline"
      className="group w-full justify-between p-4 text-left hover:bg-muted/50"
      onClick={(e) => handleSearch(e, search)}
    >
      <span>{search}</span>
      <ArrowUpRightIcon className="size-4 opacity-50 transition-opacity group-hover:opacity-100" />
    </Button>
  );
}

export function useRandomSuggestions(count: number = 3) {
  return useMemo(() => getRandomItems(ALL_SUGGESTED_SEARCHES, count), [count]);
}

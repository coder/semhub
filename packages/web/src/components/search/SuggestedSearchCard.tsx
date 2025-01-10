import { ArrowUpRightIcon } from "lucide-react";
import { useMemo } from "react";

import { getRandomItems } from "@/core/util/random";
import { usePublicSearch } from "@/hooks/usePublicSearch";
import { Button } from "@/components/ui/button";

// Pool of suggested searches covering different use cases and operators
const ALL_SUGGESTED_SEARCHES = [
  // Editor related
  'label:"good first issue" state:open repo:vscode renderer',
  // Terminal related
  'repo:ghostty label:"input" modifier',
  "repo:neovim startup performance",
  "repo:alacritty gpu rendering",
  // Frontend frameworks
  'repo:svelte state:open label:"runes"',
  "org:vercel app router",
  "repo:solidjs reactive primitives",
  "repo:vuejs composition api",
  "org:withastro server components",
  // Programming languages
  'repo:rust title:"lifetime"',
  "repo:TypeScript type inference",
  "repo:golang/go concurrency",
  "repo:kubernetes pod networking",
] as const;

interface SuggestedSearchCardProps {
  search: string;
}

export function SuggestedSearchCard({ search }: SuggestedSearchCardProps) {
  const { handleSearch } = usePublicSearch();

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

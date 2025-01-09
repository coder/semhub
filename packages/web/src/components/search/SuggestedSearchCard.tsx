import { ArrowUpRightIcon } from "lucide-react";
import { useMemo } from "react";

import { getRandomItems } from "@/core/util/random";
import { usePublicSearch } from "@/hooks/usePublicSearch";
import { Button } from "@/components/ui/button";

// Pool of suggested searches covering different use cases and operators
const ALL_SUGGESTED_SEARCHES = [
  // Editor related
  'label:"good first issue" state:open repo:vscode renderer',
  'collection:"editor" label:"good first issue" bug',
  'collection:"editor" vim mode',

  // Terminal related
  'collection:"terminal" label:"enhancement" speed',
  'collection:"terminal" title:"performance" scroll',
  'repo:ghostty label:"input" modifier',

  // Frontend frameworks
  'collection:"frontend" label:"help wanted"',
  'collection:"frontend" title:"api"',
  'repo:svelte label:"bug" state:open',
  'org:vercel label:"documentation" Nextjs15',

  // Programming languages
  'collection:"languages" label:"help wanted" bug',
  'collection:"languages" "compiler"',
  'repo:rust title:"lifetime"',
  'repo:go "performance"',

  // General queries
  "memory leak fix",
  "loading spinner example",
  "password reset endpoint",
  "rate limit error",
  "websocket connection issue",
  "login form template",
  "database connection timeout",
  "image upload example",
  "jwt token expired",
  "infinite scroll implementation",
  "oauth authentication flow",
  "docker compose setup",
  "api response caching",
  "search autocomplete component",
  "responsive navbar example",
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

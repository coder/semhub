import { ArrowUpRightIcon } from "lucide-react";
import { useMemo } from "react";

import { getRandomItems } from "@/core/util/random";
import { usePublicSearch } from "@/hooks/usePublicSearch";
import { Button } from "@/components/ui/button";

// Pool of suggested searches covering different use cases and operators
const ALL_SUGGESTED_SEARCHES = [
  // Editor related
  'label:"good first issue" state:open repo:vscode',
  'collection:"editor" label:"good first issue"',
  'repo:helix "vim mode" state:open',
  'repo:emacs title:"package" state:open',

  // Terminal related
  'collection:"terminal" label:"enhancement"',
  'repo:wezterm title:"performance"',
  'repo:alacritty label:"bug"',

  // Frontend frameworks
  'collection:"frontend" label:"help wanted"',
  'repo:next.js title:"api routes"',
  'repo:svelte label:"bug" state:open',
  'org:vercel label:"documentation"',

  // Programming languages
  'collection:"languages" label:"help wanted"',
  'repo:TypeScript "compiler"',
  'repo:rust title:"async"',
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

import { usePublicSearch } from "@/hooks/usePublicSearch";
import { Button } from "@/components/ui/button";

import { HomepageSearchBar } from "./search/PublicSearchBars";

// TODO: modify
const suggestedSearches = [
  'extensions label:"good first issue" repo:vscode',
  "networking issues org:coder",
  'label:"bug" web components',
];

function SuggestedSearchCard({ search }: { search: string }) {
  const { handleSearch } = usePublicSearch();

  return (
    <Button
      variant="outline"
      className="w-full justify-start p-4 text-left hover:bg-muted/50"
      onClick={(e) => handleSearch(e, search)}
    >
      {search}
    </Button>
  );
}

export function HomepageSearch() {
  return (
    <div className="relative flex w-full justify-center pt-28">
      <div className="w-full max-w-screen-xl px-4 text-center">
        <h1 className="mb-4 font-serif text-5xl tracking-tight">
          <span className="text-blue-600 dark:text-blue-500">Sem</span>antic
          search for Git<span className="text-orange-500">Hub</span>
          <span className="animate-cursor text-blue-600 dark:text-blue-500">
            _
          </span>
        </h1>
        <HomepageSearchBar />

        <div className="mt-12">
          <h2 className="mb-4 text-lg font-medium text-muted-foreground">
            Suggested Searches
          </h2>
          <div className="mx-auto flex max-w-lg flex-col items-center gap-2">
            {suggestedSearches.map((search) => (
              <SuggestedSearchCard key={search} search={search} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

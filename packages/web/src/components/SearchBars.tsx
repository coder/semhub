import { SearchIcon, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";

import { useSearch } from "@/hooks/useSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SearchBar({ query: initialQuery }: { query: string }) {
  const [query, setQuery] = useState(initialQuery);
  const { handleSearch } = useSearch();

  const handleClear = () => {
    setQuery("");
  };

  return (
    <form onSubmit={(e) => handleSearch(e, query)} className="mb-6">
      <div className="relative mx-auto w-full">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pr-20" // Make room for the icons
          placeholder="Search issues..."
        />

        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-8 top-1/2 -translate-y-1/2"
            onClick={handleClear}
          >
            <X className="size-4 text-muted-foreground" />
          </Button>
        )}

        <Button
          type="submit"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2"
        >
          <SearchIcon className="size-4 text-muted-foreground" />
        </Button>
      </div>
    </form>
  );
}

export function HomepageSearchBar() {
  const { theme } = useTheme();
  const [query, setQuery] = useState("");
  const { handleSearch, handleLuckySearch } = useSearch();
  return (
    <>
      <form
        onSubmit={(e) => handleSearch(e, query)}
        className="relative mx-auto w-full max-w-xl"
      >
        {/* TODO: replace with Tanstack Form */}
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // placeholder="Search SemHub"
          className="w-full rounded-full border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <SearchIcon
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          size={20}
        />
      </form>
      <div className="mt-8 space-x-4">
        <Button
          type="submit"
          onClick={(e) => handleSearch(e, query)}
          variant="secondary"
        >
          SemHub Search
        </Button>
        <Button
          variant="secondary"
          onClick={(e) => handleLuckySearch(e, query)}
        >
          <span className="inline-block w-32 text-center">
            {theme === "dark" ? "Time to Get Lucky" : "I'm Feeling Lucky"}
          </span>
        </Button>
      </div>
    </>
  );
}

import { SearchIcon, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";

import { useSearch } from "@/hooks/useSearch";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Input } from "@/components/ui/input";

const SEARCH_OPERATORS = [
  { name: "Title", description: "Search in issue titles", prefix: "title:" },
  { name: "Body", description: "Search in issue contents", prefix: "body:" },
];

export function SearchBar({ query: initialQuery }: { query: string }) {
  const { handleSearch } = useSearch();

  const [query, setQuery] = useState(initialQuery);
  const [showOperators, setShowOperators] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart ?? 0;
    setQuery(value);

    // Find the word at cursor position
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);

    const beforeSpace = textBeforeCursor.lastIndexOf(" ");
    const afterSpace = textAfterCursor.indexOf(" ");

    const start = beforeSpace === -1 ? 0 : beforeSpace + 1;
    const end = afterSpace === -1 ? value.length : cursorPosition + afterSpace;

    const currentWord = value.slice(start, end);

    // Calculate filteredOperators directly
    const filteredOperators = SEARCH_OPERATORS.filter((op) =>
      op.name.toLowerCase().startsWith(currentWord.toLowerCase()),
    );

    setShowOperators(currentWord.length > 0 && filteredOperators.length > 0);
  };
  console.log({ showOperators });

  // Move filteredOperators calculation here for use in render
  const currentWord = (() => {
    const cursorPosition =
      document.activeElement instanceof HTMLInputElement
        ? (document.activeElement.selectionStart ?? 0)
        : 0;
    const textBeforeCursor = query.slice(0, cursorPosition);
    const textAfterCursor = query.slice(cursorPosition);
    const beforeSpace = textBeforeCursor.lastIndexOf(" ");
    const afterSpace = textAfterCursor.indexOf(" ");
    const start = beforeSpace === -1 ? 0 : beforeSpace + 1;
    const end = afterSpace === -1 ? query.length : cursorPosition + afterSpace;
    return query.slice(start, end);
  })();

  const filteredOperators = SEARCH_OPERATORS.filter((op) =>
    op.name.toLowerCase().startsWith(currentWord.toLowerCase()),
  );

  const handleOperatorSelect = (operator: (typeof SEARCH_OPERATORS)[0]) => {
    const words = query.split(" ");
    words[words.length - 1] = operator.prefix;
    setQuery(words.join(" ") + " ");
    setShowOperators(false);
  };

  const handleClear = () => {
    setQuery("");
  };

  return (
    <div className="relative">
      <form onSubmit={(e) => handleSearch(e, query)} className="mb-6">
        <div className="relative mx-auto w-full">
          <Input
            value={query}
            onChange={handleInputChange}
            className="pr-20"
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

      {showOperators && (
        <div className="absolute z-10 w-full rounded-md border bg-popover shadow-md">
          <Command>
            <CommandGroup>
              {filteredOperators.map((operator) => (
                <CommandItem
                  key={operator.name}
                  onSelect={() => handleOperatorSelect(operator)}
                >
                  <div>
                    <div className="font-medium">{operator.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {operator.description}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </div>
      )}
    </div>
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

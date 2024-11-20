import { SearchIcon, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useRef, useState } from "react";

import { useSearch } from "@/hooks/useSearch";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";

const SEARCH_OPERATORS = [
  { name: "Title", description: "Search in issue titles", prefix: "title:" },
  { name: "Body", description: "Search in issue contents", prefix: "body:" },
  { name: "Tody", description: "Search in issue contents", prefix: "tody:" },
];

const getFilteredOperators = (word: string) =>
  SEARCH_OPERATORS.filter((op) =>
    op.prefix.toLowerCase().startsWith(word.toLowerCase()),
  );

export function SearchBar({ query: initialQuery }: { query: string }) {
  const { handleSearch, getWordOnCursor } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(initialQuery);
  const [showOperators, setShowOperators] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [cursorWord, setCursorWord] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    const currentCursorPosition = e.target.selectionStart ?? 0;
    setCursorPosition(currentCursorPosition);
    const currentWord = getWordOnCursor(value, currentCursorPosition);
    setCursorWord(currentWord);
    const filteredOperators = getFilteredOperators(currentWord);
    setShowOperators(currentWord.length > 0 && filteredOperators.length > 0);
  };

  const filteredOperators = getFilteredOperators(cursorWord);

  const handleOperatorSelect = (operator: (typeof SEARCH_OPERATORS)[0]) => {
    // Insert the operator at cursor position, replacing the current partial word
    const newQuery =
      query.slice(0, cursorPosition - cursorWord.length) +
      `${operator.prefix}""` +
      query.slice(cursorPosition);
    setQuery(newQuery);
    setShowOperators(false);
    // Restore cursor position after the operator
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPosition =
          cursorPosition - cursorWord.length + operator.prefix.length + 1;
        inputRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  const handleClear = () => {
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showOperators) return;

    if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      const syntheticEvent = new KeyboardEvent("keydown", {
        key: e.key,
        bubbles: true,
      });
      commandInputRef.current?.dispatchEvent(syntheticEvent);
    }
  };

  return (
    <div className="relative mx-auto w-full">
      <form onSubmit={(e) => handleSearch(e, query)}>
        <div className="relative">
          <Input
            value={query}
            onChangeCapture={handleInputChange}
            onKeyDown={handleKeyDown}
            ref={inputRef}
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
        {showOperators && (
          <div className="absolute z-10 w-full">
            <Command loop>
              <CommandInput
                ref={commandInputRef}
                value={cursorWord}
                className="hidden"
              />
              <CommandList className="mt-2 rounded-lg border bg-popover shadow-lg ring-1 ring-black/5 dark:ring-white/5">
                <CommandGroup>
                  {filteredOperators.map((operator) => (
                    <CommandItem
                      key={operator.name}
                      onSelect={() => handleOperatorSelect(operator)}
                      className="px-4 py-2"
                    >
                      {operator.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        )}
      </form>
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

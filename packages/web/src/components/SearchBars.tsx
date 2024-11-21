import { SearchIcon, X } from "lucide-react";
import { useTheme } from "next-themes";

import { useSearch } from "@/hooks/useSearch";
import { getFilteredOperators, useSearchBar } from "@/hooks/useSearchBar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";

export function SearchBar({ query: initialQuery }: { query: string }) {
  const { handleSearch } = useSearch();
  const {
    query,
    showDropdown,
    cursorWord,
    inputRef,
    commandInputRef,
    handleInputChange,
    handleOperatorSelect,
    handleKeyDown,
    handleFocus,
    handleBlur,
    setQuery,
    commandRef,
  } = useSearchBar(initialQuery);

  const handleClear = () => {
    setQuery("");
  };

  return (
    <div className="relative mx-auto w-full">
      <form onSubmit={(e) => handleSearch(e, query)}>
        <div className="relative">
          <Input
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
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
        {showDropdown && (
          <div className="absolute z-10 w-full">
            <Command
              ref={commandRef}
              loop
              className="w-64 bg-transparent"
              style={{ transform: "translateX(var(--cursor-x, 0))" }}
            >
              <CommandInput
                ref={commandInputRef}
                value={cursorWord}
                className="hidden"
              />
              <CommandList className="mt-2 rounded-lg border bg-popover shadow-lg ring-1 ring-black/5 dark:ring-white/5">
                <CommandGroup>
                  {getFilteredOperators(cursorWord).map((o) => (
                    <CommandItem
                      key={o.operator}
                      onSelect={() => handleOperatorSelect(o)}
                      className="px-4 py-2"
                    >
                      {o.icon}
                      <span className="ml-2">{o.name}</span>
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
  const { handleSearch, handleLuckySearch } = useSearch();
  const {
    query,
    showDropdown,
    cursorWord,
    inputRef,
    commandInputRef,
    handleInputChange,
    handleOperatorSelect,
    handleKeyDown,
    handleFocus,
    handleBlur,
    commandRef,
  } = useSearchBar();

  return (
    <>
      <form
        onSubmit={(e) => handleSearch(e, query)}
        className="relative mx-auto w-full max-w-xl"
      >
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="w-full rounded-full border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <SearchIcon
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          size={20}
        />
        {showDropdown && (
          <div className="absolute z-10 w-full">
            <Command
              ref={commandRef}
              loop
              className="w-64 bg-transparent"
              style={{ transform: "translateX(var(--cursor-x, 0))" }}
            >
              <CommandInput
                ref={commandInputRef}
                value={cursorWord}
                className="hidden"
              />
              <CommandList className="mt-2 rounded-lg border bg-popover shadow-lg ring-1 ring-black/5 dark:ring-white/5">
                <CommandGroup>
                  {getFilteredOperators(cursorWord).map((o) => (
                    <CommandItem
                      key={o.operator}
                      onSelect={() => handleOperatorSelect(o)}
                      className="px-4 py-2"
                    >
                      {o.icon}
                      <span className="ml-2">{o.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        )}
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

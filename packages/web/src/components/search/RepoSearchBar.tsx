import { SearchIcon, XIcon } from "lucide-react";
import { useTheme } from "next-themes";

import type { SearchOperator } from "@/core/constants/search.constant";
import { usePublicSearch } from "@/hooks/usePublicSearch";
import { useSearchBar } from "@/hooks/useSearchBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchDropdownMenu } from "@/components/search/SearchDropdownMenu";

interface RepoSearchBarProps {
  owner: string;
  repo: string;
}

export function RepoSearchBar({ owner, repo }: RepoSearchBarProps) {
  const { theme } = useTheme();
  const removedOperators = ["org", "repo", "collection"] as SearchOperator[];
  const {
    query,
    inputRef,
    commandInputRef,
    commandRef,
    commandInputValue,
    subMenu,
    shouldShowDropdown,
    handleClear,
    handleInputChange,
    handleOperatorSelect,
    handleValueSelect,
    handleKeyDown,
    handleFocus,
    handleBlur,
    commandValue,
    setCommandValue,
    setQuery,
  } = useSearchBar({
    removedOperators,
  });
  const { handleSearch, handleLuckySearch } = usePublicSearch({
    mode: "repo_search",
    setQuery,
    owner,
    repo,
  });

  return (
    <form onSubmit={(e) => handleSearch(e, query)}>
      <div className="relative mx-auto w-full max-w-xl">
        <div className="relative">
          <SearchIcon
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={18}
          />
          <Input
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            ref={inputRef}
            className="rounded-full border-gray-300 pl-11 pr-10 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            placeholder="Search GitHub issues..."
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={handleClear}
            >
              <XIcon className="size-4 text-muted-foreground" />
            </Button>
          )}
        </div>
        {shouldShowDropdown && (
          <div className="absolute z-10 w-full">
            <SearchDropdownMenu
              commandRef={commandRef}
              commandInputRef={commandInputRef}
              commandInputValue={commandInputValue}
              subMenu={subMenu}
              handleOperatorSelect={handleOperatorSelect}
              handleValueSelect={handleValueSelect}
              commandValue={commandValue}
              setCommandValue={setCommandValue}
              removedOperators={removedOperators}
            />
          </div>
        )}
        <div className="mt-8 flex justify-center space-x-4">
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
      </div>
    </form>
  );
}

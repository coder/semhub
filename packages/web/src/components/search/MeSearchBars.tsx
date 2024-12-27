import { SearchIcon, XIcon } from "lucide-react";

import { useSearchBar } from "@/hooks/useSearchBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchDropdownMenu } from "@/components/search/SearchDropdownMenu";

export function MyReposResultsSearchBar({
  query: initialQuery,
}: {
  query: string;
}) {
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
  } = useSearchBar(initialQuery);

  return (
    <div className="relative mx-auto w-full">
      <form onSubmit={(e) => console.log(e, query)}>
        <div className="relative">
          <Input
            type="text"
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
              <XIcon className="size-4 text-muted-foreground" />
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
            />
          </div>
        )}
      </form>
    </div>
  );
}
export function MyReposSearchBar() {
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
  } = useSearchBar();

  return (
    <div className="relative mx-auto w-full">
      <form onSubmit={(e) => console.log(e, query)}>
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="rounded-full border-gray-300 pl-10 focus:border-transparent focus:ring-2 focus:ring-blue-500"
        />
        <SearchIcon
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          size={20}
        />
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
            />
          </div>
        )}
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
      </form>
    </div>
  );
}

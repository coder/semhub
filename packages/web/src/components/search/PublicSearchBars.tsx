import {
  ChevronDownIcon,
  CodeIcon,
  GlobeIcon,
  LayoutIcon,
  MonitorIcon,
  SearchIcon,
  TerminalIcon,
  XIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";

import { usePlaceholderAnimation } from "@/hooks/usePlaceholderAnimation";
import { usePublicSearch } from "@/hooks/usePublicSearch";
import { useSearchBar } from "@/hooks/useSearchBar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SearchDropdownMenu } from "@/components/search/SearchDropdownMenu";
import {
  SEARCH_OPERATORS,
  type SearchOperator,
} from "@/../../core/src/constants/search.constant";

const collections = [
  { value: "all", label: "All collections", icon: GlobeIcon },
  { value: "editor", label: "Text editors", icon: MonitorIcon },
  { value: "terminal", label: "Terminal emulators", icon: TerminalIcon },
  { value: "frontend", label: "Frontend frameworks", icon: LayoutIcon },
  { value: "languages", label: "Programming languages", icon: CodeIcon },
];

// TODO: hard-coded for now, fetch from API eventually
const owners = [
  { value: "all", label: "All orgs", icon: GlobeIcon },
  {
    value: "microsoft",
    label: "Microsoft",
    avatarUrl: "https://avatars.githubusercontent.com/u/6154722?v=4",
  },
  {
    value: "vercel",
    label: "Vercel",
    avatarUrl: "https://avatars.githubusercontent.com/u/14985020?v=4",
  },
  {
    value: "coder",
    label: "Coder",
    avatarUrl: "https://avatars.githubusercontent.com/u/95932066?v=4",
  },
];

function FilterDropdown({
  options,
  value,
  onChange,
}: {
  options: typeof collections | typeof owners;
  value: string;
  onChange: (value: string) => void;
}) {
  const selectedItem = options.find((item) => item.value === value);
  const Icon = selectedItem?.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 px-2 py-1 text-sm font-normal hover:bg-accent"
        >
          {Icon ? (
            <Icon className="size-4" />
          ) : (
            selectedItem?.avatarUrl && (
              <img
                src={selectedItem.avatarUrl}
                alt={selectedItem.label}
                className="size-4 rounded-full"
              />
            )
          )}
          <span>{selectedItem?.label}</span>
          <ChevronDownIcon className="size-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        {options.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem
              key={item.value}
              onClick={() => onChange(item.value)}
              className="flex items-center gap-2"
            >
              {Icon ? (
                <Icon className="size-4" />
              ) : (
                item.avatarUrl && (
                  <img
                    src={item.avatarUrl}
                    alt={item.label}
                    className="size-4 rounded-full"
                  />
                )
              )}
              <span>{item.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Shared function to handle filter changes
function updateQueryWithFilter(
  query: string,
  filterType: "org" | "collection",
  value: string,
) {
  // Remove any existing operators of this type
  const pattern = new RegExp(
    `${filterType}:"[^"]*"\\s*|${filterType}:[^\\s]*\\s*`,
    "g",
  );
  const queryWithoutFilter = query.replace(pattern, "").trim();

  // Add new operator if a specific value is selected
  if (value !== "all") {
    // Check if the operator should be enclosed in quotes based on SEARCH_OPERATORS
    const operator = SEARCH_OPERATORS.find(
      (op: { operator: SearchOperator }) => op.operator === filterType,
    );
    const formattedValue = operator?.enclosedInQuotes ? `"${value}"` : value;
    return `${filterType}:${formattedValue} ${queryWithoutFilter}`.trim();
  }
  return queryWithoutFilter;
}

function SearchFilters({
  selectedOrg,
  selectedCollection,
  onOrgChange,
  onCollectionChange,
}: {
  selectedOrg: string;
  selectedCollection: string;
  onOrgChange: (org: string) => void;
  onCollectionChange: (collection: string) => void;
}) {
  return (
    <div className="flex gap-1">
      <FilterDropdown
        options={collections}
        value={selectedCollection}
        onChange={onCollectionChange}
      />
      <FilterDropdown
        options={owners}
        value={selectedOrg}
        onChange={onOrgChange}
      />
    </div>
  );
}

export function ResultsSearchBar({ query: initialQuery }: { query: string }) {
  const { handleSearch } = usePublicSearch();
  const [selectedOrg, setSelectedOrg] = useState("all");
  const [selectedCollection, setSelectedCollection] = useState("all");
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
  } = useSearchBar(initialQuery);

  const handleOrgChange = (org: string) => {
    setSelectedOrg(org);
    setQuery(updateQueryWithFilter(query, "org", org));
  };

  const handleCollectionChange = (collection: string) => {
    setSelectedCollection(collection);
    setQuery(updateQueryWithFilter(query, "collection", collection));
  };

  return (
    <form onSubmit={(e) => handleSearch(e, query)}>
      <div className="relative mx-auto w-full">
        <div className="mb-2 flex items-center gap-1">
          <SearchFilters
            selectedOrg={selectedOrg}
            selectedCollection={selectedCollection}
            onOrgChange={handleOrgChange}
            onCollectionChange={handleCollectionChange}
          />
        </div>
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
      </div>
    </form>
  );
}

export function HomepageSearchBar() {
  const { theme } = useTheme();
  const { handleSearch, handleLuckySearch } = usePublicSearch();
  const [selectedOrg, setSelectedOrg] = useState("all");
  const [selectedCollection, setSelectedCollection] = useState("all");
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
  } = useSearchBar();
  const placeholderText = usePlaceholderAnimation();

  const handleOrgChange = (org: string) => {
    setSelectedOrg(org);
    setQuery(updateQueryWithFilter(query, "org", org));
  };

  const handleCollectionChange = (collection: string) => {
    setSelectedCollection(collection);
    setQuery(updateQueryWithFilter(query, "collection", collection));
  };

  return (
    <form onSubmit={(e) => handleSearch(e, query)}>
      <div className="flex flex-col items-center">
        <div className="relative mx-auto w-full max-w-xl">
          <div className="mb-2 flex items-center gap-1">
            <SearchFilters
              selectedOrg={selectedOrg}
              selectedCollection={selectedCollection}
              onOrgChange={handleOrgChange}
              onCollectionChange={handleCollectionChange}
            />
          </div>
          <div className="relative">
            <SearchIcon
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={18}
            />
            <Input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              className="rounded-full border-gray-300 pl-11 pr-10 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              placeholder={placeholderText}
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
              />
            </div>
          )}
        </div>
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
      </div>
    </form>
  );
}

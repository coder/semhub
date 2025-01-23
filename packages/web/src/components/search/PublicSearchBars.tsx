import { ChevronDownIcon, GlobeIcon, SearchIcon, XIcon } from "lucide-react";
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
import { EmbedBadgePopover } from "@/components/embed/EmbedBadgePopover";
import { HighlightedInput } from "@/components/search/HighlightedInput";
import { SearchDropdownMenu } from "@/components/search/SearchDropdownMenu";
import {
  SEARCH_OPERATORS,
  type SearchOperator,
} from "@/../../core/src/constants/search.constant";

// TODO: hard-coded for now, fetch from API eventually
const owners = [
  { value: "all", label: "All orgs", icon: GlobeIcon },
  {
    value: "microsoft",
    label: "Microsoft",
    avatarUrl: "https://avatars.githubusercontent.com/u/6154722?v=4",
  },
  {
    value: "facebook",
    label: "Meta",
    avatarUrl: "https://avatars.githubusercontent.com/u/69631?v=4",
  },
  {
    value: "hashicorp",
    label: "HashiCorp",
    avatarUrl: "https://avatars.githubusercontent.com/u/761456?v=4",
  },
  {
    value: "vercel",
    label: "Vercel",
    avatarUrl: "https://avatars.githubusercontent.com/u/14985020?v=4",
  },
  {
    value: "coder",
    label: "coder",
    avatarUrl: "https://avatars.githubusercontent.com/u/95932066?v=4",
  },
];

// TODO: hard-coded for now, fetch from API eventually
const repos = [
  { value: "all", label: "All repos", icon: GlobeIcon },
  {
    value: "microsoft/typescript",
    label: "TypeScript",
    avatarUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Typescript.svg/260px-Typescript.svg.png",
  },
  {
    value: "golang/go",
    label: "Go",
    avatarUrl:
      "https://cdn.icon-icons.com/icons2/2699/PNG/512/golang_logo_icon_171073.png",
  },
  {
    value: "rust-lang/rust",
    label: "Rust",
    avatarUrl: "https://avatars.githubusercontent.com/u/5430905?v=4",
  },
  {
    value: "microsoft/vscode",
    label: "VS Code",
    avatarUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Visual_Studio_Code_1.35_icon.svg/512px-Visual_Studio_Code_1.35_icon.svg.png",
  },
  {
    value: "getcursor/cursor",
    label: "Cursor",
    avatarUrl: "https://avatars.githubusercontent.com/u/126759922?v=4",
  },
  {
    value: "coder/coder",
    label: "coder/coder",
    avatarUrl: "https://avatars.githubusercontent.com/u/95932066?v=4",
  },
  {
    value: "warpdotdev/warp",
    label: "Warp",
    avatarUrl: "https://avatars.githubusercontent.com/u/71840468?&v=4",
  },
  {
    value: "ghostty-org/ghostty",
    label: "Ghostty",
    avatarUrl: "https://avatars.githubusercontent.com/u/169223740?v=4",
  },
];

function FilterDropdown({
  options,
  value,
  onChange,
}: {
  options: typeof repos | typeof owners;
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
  filterType: "org" | "repo",
  value: string,
) {
  // Remove any existing operator
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
  selectedRepo,
  onOrgChange,
  onRepoChange,
}: {
  selectedOrg: string;
  selectedRepo: string;
  onOrgChange: (org: string) => void;
  onRepoChange: (repo: string) => void;
}) {
  return (
    <div className="flex gap-1">
      <FilterDropdown
        options={owners}
        value={selectedOrg}
        onChange={onOrgChange}
      />
      <FilterDropdown
        options={repos}
        value={selectedRepo}
        onChange={onRepoChange}
      />
    </div>
  );
}

export function ResultsSearchBar({ query: initialQuery }: { query: string }) {
  const [selectedOrg, setSelectedOrg] = useState("all");
  const [selectedRepo, setSelectedRepo] = useState("all");
  const removedOperators = ["collection"] as SearchOperator[];
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
    initialQuery,
    removedOperators,
  });
  const { handleSearch } = usePublicSearch({ mode: "search", setQuery });

  const handleOrgChange = (org: string) => {
    setSelectedOrg(org);
    setQuery(updateQueryWithFilter(query, "org", org));
  };

  const handleRepoChange = (repo: string) => {
    setSelectedRepo(repo);
    setQuery(updateQueryWithFilter(query, "repo", repo));
  };

  return (
    <form onSubmit={(e) => handleSearch(e, query)}>
      <div className="relative mx-auto w-full">
        <div className="mb-2 flex items-center justify-between">
          <SearchFilters
            selectedOrg={selectedOrg}
            selectedRepo={selectedRepo}
            onOrgChange={handleOrgChange}
            onRepoChange={handleRepoChange}
          />
          <EmbedBadgePopover owner="your" repo="repo" />
        </div>
        <div className="relative">
          <HighlightedInput
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            ref={inputRef}
            removedOperators={removedOperators}
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
              removedOperators={removedOperators}
            />
          </div>
        )}
      </div>
    </form>
  );
}

export function HomepageSearchBar() {
  const { theme } = useTheme();
  const [selectedOrg, setSelectedOrg] = useState("all");
  const [selectedRepo, setSelectedRepo] = useState("all");
  const removedOperators = ["collection"] as SearchOperator[];
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
  } = useSearchBar({ removedOperators });
  const { handleSearch, handleLuckySearch } = usePublicSearch({
    mode: "search",
    setQuery,
  });
  const placeholderText = usePlaceholderAnimation();

  const handleOrgChange = (org: string) => {
    setSelectedOrg(org);
    setQuery(updateQueryWithFilter(query, "org", org));
  };

  const handleRepoChange = (repo: string) => {
    setSelectedRepo(repo);
    setQuery(updateQueryWithFilter(query, "repo", repo));
  };

  return (
    <form onSubmit={(e) => handleSearch(e, query)}>
      <div className="flex flex-col items-center">
        <div className="relative mx-auto w-full max-w-xl">
          <div className="mb-2 flex items-center gap-1">
            <SearchFilters
              selectedOrg={selectedOrg}
              selectedRepo={selectedRepo}
              onOrgChange={handleOrgChange}
              onRepoChange={handleRepoChange}
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
                removedOperators={removedOperators}
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

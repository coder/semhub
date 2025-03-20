import { HomepageSearchBar } from "./PublicSearchBars";
import {
  SuggestedSearchCard,
  useRandomSuggestions,
} from "./SuggestedSearchCard";

export function HomepageSearch() {
  const suggestedSearches = useRandomSuggestions();

  return (
    <div className="relative flex w-full justify-center pt-28">
      <div className="w-full max-w-screen-xl px-4 text-center">
        <h1 className="mb-4 font-serif text-5xl tracking-tight">
          <span className="text-blue-600 dark:text-blue-400">Sem</span>
          antic Search for Git
          <span className="text-orange-500">Hub </span>
          Issues
        </h1>

        {/* Search bar section */}
        <div className="relative">
          <HomepageSearchBar />
        </div>
        {/* Suggested searches section */}
        <div className="mx-auto mt-24 grid max-w-xl grid-cols-1 gap-2 sm:mt-8 sm:grid-cols-2 sm:gap-4">
          {suggestedSearches.slice(0, 4).map((search) => (
            <SuggestedSearchCard key={search} search={search} />
          ))}
        </div>
      </div>
    </div>
  );
}

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
          <span className="text-blue-600 dark:text-blue-500">Sem</span>antic
          search for Git<span className="text-orange-500">Hub</span>
          <span className="animate-cursor text-blue-600 dark:text-blue-500">
            _
          </span>
        </h1>
        <HomepageSearchBar />

        <div className="mx-auto mt-8 flex max-w-lg flex-col items-center gap-2">
          {suggestedSearches.map((search) => (
            <SuggestedSearchCard key={search} search={search} />
          ))}
        </div>
      </div>
    </div>
  );
}

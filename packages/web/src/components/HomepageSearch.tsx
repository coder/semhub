import { HomepageSearchBar } from "./search/PublicSearchBars";

const suggestedSearches = [
  "a short article about the early days of Google",
  "Start ups working on genetic sequencing",
  "Similar to https://waitbutwhy.com",
  "Samsung earnings report",
];

export function HomepageSearch() {
  return (
    <div className="relative flex w-full justify-center pt-28">
      <div className="w-full max-w-screen-xl px-4 text-center">
        <h1 className="mb-4 font-serif text-5xl tracking-tight">
          <span className="text-blue-600 dark:text-blue-500">Sem</span>antic
          search for Git<span className="text-orange-500">Hub</span>{" "}
        </h1>
        <HomepageSearchBar />

        <div className="mt-12">
          <h2 className="mb-4 text-lg font-medium text-muted-foreground">
            Suggested Searches
          </h2>
          <div className="mx-auto flex max-w-lg flex-col items-center gap-2">
            {suggestedSearches.map((search) => (
              <button
                key={search}
                className="w-full rounded-lg border border-gray-200 bg-background px-4 py-2 text-left text-sm hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                onClick={() => {
                  // TODO: Implement search functionality
                }}
              >
                {search}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

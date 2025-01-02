import { Link } from "@tanstack/react-router";

import { HomepageSearchBar } from "./search/PublicSearchBars";

export function HomepageSearch() {
  return (
    // Using relative positioning and min-h-[calc(100vh-4rem)] instead of absolute inset-0
    // to prevent the div from overlaying and blocking clicks on the header.
    // The 4rem subtraction accounts for the header height (64px).
    <div className="relative flex w-full justify-center pt-28">
      <div className="w-full max-w-screen-xl px-4 text-center">
        <Link to="/">
          <div className="relative mb-4 h-24">
            {/* Light mode version */}
            <h1 className="absolute inset-0 flex items-center justify-center font-sans text-6xl dark:hidden">
              <span className="font-semibold text-blue-500">S</span>
              <span className="font-semibold text-red-500">e</span>
              <span className="font-semibold text-yellow-500">m</span>
              <span className="font-semibold text-blue-500">H</span>
              <span className="font-semibold text-green-500">u</span>
              <span className="font-semibold text-red-500">b</span>
            </h1>
            {/* Dark mode version */}
            <h1 className="absolute inset-0 hidden items-center justify-center rounded px-4 py-2 font-sans text-6xl dark:flex">
              <span className="ml-1 rounded-lg bg-[#F0931B] px-2 py-1 font-semibold text-black">
                Sem
              </span>
              <span className="font-semibold text-white">Hub</span>
            </h1>
          </div>
        </Link>
        <HomepageSearchBar />
      </div>
    </div>
  );
}

import { Link } from "@tanstack/react-router";

import { HomepageSearchBar } from "./SearchBars";

export function HomepageSearch() {
  return (
    <div className="mb-8 text-center">
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
            <span className="font-semibold text-white">Sem</span>
            <span className="ml-1 rounded-lg bg-[#F0931B] px-2 py-1 font-semibold text-black">
              Hub
            </span>
          </h1>
        </div>
      </Link>
      <HomepageSearchBar />
    </div>
  );
}

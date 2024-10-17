import { Search as SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Search() {
  return (
    <div className="mb-8 text-center">
      <h1 className="mb-4 font-sans text-6xl">
        <span className="font-semibold text-blue-500">S</span>
        <span className="font-semibold text-red-500">e</span>
        <span className="font-semibold text-yellow-500">m</span>
        <span className="font-semibold text-blue-500">H</span>
        <span className="font-semibold text-green-500">u</span>
        <span className="font-semibold text-red-500">b</span>
      </h1>
      <div className="relative mx-auto w-full max-w-xl">
        <Input
          type="text"
          // placeholder="Search SemHub"
          className="w-full rounded-full border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <SearchIcon
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          size={20}
        />
      </div>
      <div className="mt-8 space-x-4">
        <Button
          variant="secondary"
          className="bg-gray-50 text-gray-800 hover:bg-gray-200"
        >
          SemHub Search
        </Button>
        <Button
          variant="secondary"
          className="bg-gray-50 text-gray-800 hover:bg-gray-200"
        >
          I'm Feeling Lucky
        </Button>
      </div>
      {/* TODO: maybe a component below that lists the repositories that are being searched */}
    </div>
  );
}

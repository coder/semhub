import { Search as SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Search() {
  return (
    <div className="text-center mb-8">
      <h1 className="text-6xl font-sans mb-4">
        <span className="text-blue-500 font-semibold">S</span>
        <span className="text-red-500 font-semibold">e</span>
        <span className="text-yellow-500 font-semibold">m</span>
        <span className="text-blue-500 font-semibold">H</span>
        <span className="text-green-500 font-semibold">u</span>
        <span className="text-red-500 font-semibold">b</span>
      </h1>
      <div className="relative w-full max-w-xl mx-auto">
        <Input
          type="text"
          // placeholder="Search SemHub"
          className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <SearchIcon
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
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

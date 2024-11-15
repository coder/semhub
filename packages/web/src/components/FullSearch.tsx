import { Link, useNavigate } from "@tanstack/react-router";
import { Search as SearchIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FullSearch() {
  const { theme } = useTheme();
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (query.trim()) {
      navigate({ to: "/search", search: { q: query } });
    }
  };

  const handleLuckySearch = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (query.trim()) {
      navigate({ to: "/search", search: { q: query, lucky: "y" } });
    }
  };

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
              hub
            </span>
          </h1>
        </div>
      </Link>
      <form
        onSubmit={handleSearch}
        className="relative mx-auto w-full max-w-xl"
      >
        {/* TODO: replace with Tanstack Form */}
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // placeholder="Search SemHub"
          className="w-full rounded-full border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <SearchIcon
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          size={20}
        />
      </form>
      <div className="mt-8 space-x-4">
        <Button type="submit" onClick={handleSearch} variant="secondary">
          SemHub Search
        </Button>
        <Button variant="secondary" onClick={handleLuckySearch}>
          <span className="inline-block w-32 text-center">
            {theme === "dark" ? "Time to Get Lucky" : "I'm Feeling Lucky"}
          </span>
        </Button>
      </div>
      {/* TODO: maybe a component below that lists the repositories that are being searched */}
    </div>
  );
}

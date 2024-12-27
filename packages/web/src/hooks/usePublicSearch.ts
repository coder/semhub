import { useNavigate } from "@tanstack/react-router";

import { injectDefaultQueries } from "@/core/semsearch.util";

export const usePublicSearch = () => {
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent, query: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (query.trim()) {
      navigate({ to: "/search", search: { q: injectDefaultQueries(query) } });
    }
  };

  const handleLuckySearch = (e: React.FormEvent, query: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (query.trim()) {
      navigate({
        to: "/search",
        search: { q: injectDefaultQueries(query), lucky: "y" },
      });
    }
  };

  return {
    handleSearch,
    handleLuckySearch,
  };
};

import { useNavigate } from "@tanstack/react-router";

import { parseSearchQuery } from "@/core/semsearch.util";

export const usePublicSearch = () => {
  const navigate = useNavigate();

  const injectDefaultQueries = (query: string) => {
    const { stateQueries } = parseSearchQuery(query);
    if (stateQueries.length === 0) {
      return `${query} state:open`;
    }
    return query;
  };

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

import { useNavigate } from "@tanstack/react-router";

import { modifyUserQuery } from "@/core/semsearch.util";

export const usePublicSearch = (setQuery?: (query: string) => void) => {
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent, query: string) => {
    e.preventDefault();
    e.stopPropagation();
    const modifiedQuery = modifyUserQuery(query);
    if (setQuery) {
      setQuery(modifiedQuery);
    }
    if (query.trim()) {
      navigate({ to: "/search", search: { q: modifiedQuery } });
    }
  };

  const handleLuckySearch = (e: React.FormEvent, query: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (query.trim()) {
      navigate({
        to: "/search",
        search: { q: modifyUserQuery(query), lucky: "y" },
      });
    }
  };

  return {
    handleSearch,
    handleLuckySearch,
  };
};

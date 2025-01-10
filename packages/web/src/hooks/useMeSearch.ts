import { useNavigate } from "@tanstack/react-router";

import { modifyUserQuery } from "@/core/semsearch.util";

export const useMeSearch = (setQuery: (query: string) => void) => {
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent, query: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (query.trim()) {
      const modifiedQuery = modifyUserQuery(query);
      setQuery(modifiedQuery);
      navigate({
        to: "/repos/search",
        search: { q: modifiedQuery },
      });
    }
  };

  return {
    handleSearch,
  };
};

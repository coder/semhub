import { useNavigate } from "@tanstack/react-router";

import { modifyUserQuery } from "@/core/semsearch.util";

export const useMeSearch = () => {
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent, query: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (query.trim()) {
      const search = { q: modifyUserQuery(query) };
      navigate({
        to: "/repos/search",
        search,
      });
    }
  };

  return {
    handleSearch,
  };
};

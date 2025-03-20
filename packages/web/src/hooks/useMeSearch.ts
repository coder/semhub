import { useNavigate } from "@tanstack/react-router";

import { modifyUserQuery } from "@/core/semsearch/util";

import { useSearchValidation } from "./useSearchValidation";

export const useMeSearch = (setQuery: (query: string) => void) => {
  const navigate = useNavigate();
  const { validateSearch, validationErrors, clearValidationErrors } =
    useSearchValidation();

  const handleSearch = (e: React.FormEvent, query: string) => {
    e.preventDefault();
    e.stopPropagation();

    const modifiedQuery = modifyUserQuery(query);
    if (!validateSearch(modifiedQuery)) {
      return;
    }
    setQuery(modifiedQuery);
    navigate({
      to: "/repos/search",
      search: { q: modifiedQuery },
    });
  };

  return {
    handleSearch,
    validationErrors,
    clearValidationErrors,
  };
};

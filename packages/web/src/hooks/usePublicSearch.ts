import { useNavigate } from "@tanstack/react-router";

import { modifyUserQuery } from "@/core/semsearch/util";

import { useSearchValidation } from "./useSearchValidation";

type SuggestedSearchArgs = {
  mode: "suggested";
};

type RepoSearchArgs = {
  mode: "repo_search";
  setQuery: (query: string) => void;
  owner: string;
  repo: string;
};

type PublicSearchArgs = {
  mode: "search";
  setQuery: (query: string) => void;
};

type SearchArgs = SuggestedSearchArgs | RepoSearchArgs | PublicSearchArgs;

export const usePublicSearch = (args: SearchArgs) => {
  const navigate = useNavigate();
  const { validateSearch, validationErrors, clearValidationErrors } =
    useSearchValidation();

  const handleSearch = (e: React.FormEvent, query: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (args.mode === "repo_search") {
      query = `repo:${args.owner}/${args.repo} ${query}`;
    }
    const modifiedQuery = modifyUserQuery(query);
    if (!validateSearch(modifiedQuery)) {
      return;
    }

    if (args.mode !== "suggested") {
      args.setQuery(modifiedQuery);
    }
    navigate({ to: "/search", search: { q: modifiedQuery } });
  };

  const handleLuckySearch = (e: React.FormEvent, query: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!validateSearch(query)) {
      return;
    }

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
    validationErrors,
    clearValidationErrors,
  };
};

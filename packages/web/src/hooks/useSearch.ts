import { useNavigate } from "@tanstack/react-router";

export const useSearch = () => {
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent, query: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (query.trim()) {
      navigate({ to: "/search", search: { q: query } });
    }
  };

  const handleLuckySearch = (e: React.FormEvent, query: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (query.trim()) {
      navigate({ to: "/search", search: { q: query, lucky: "y" } });
    }
  };

  return {
    handleSearch,
    handleLuckySearch,
  };
}; 

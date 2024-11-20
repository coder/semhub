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

  const getWordOnCursor = (input: string, cursorPosition: number) => {
    const textBeforeCursor = input.slice(0, cursorPosition);
    const textAfterCursor = input.slice(cursorPosition);
    const beforeSpace = textBeforeCursor.lastIndexOf(" ");
    const afterSpace = textAfterCursor.indexOf(" ");
    const start = beforeSpace === -1 ? 0 : beforeSpace + 1;
    const end = afterSpace === -1 ? input.length : cursorPosition + afterSpace;
    return input.slice(start, end);
  };

  return {
    handleSearch,
    handleLuckySearch,
    getWordOnCursor,
  };
};

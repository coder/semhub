import { AlignJustifyIcon, Heading1Icon } from "lucide-react";
import { useRef, useState } from "react";

import { SEARCH_OPERATORS } from "@/core/constants/search";

const OPERATORS_WITH_ICONS = [
  {
    name: "Title",
    operator: SEARCH_OPERATORS[0],
    icon: <Heading1Icon />,
  },
  {
    name: "Body",
    operator: SEARCH_OPERATORS[1],
    icon: <AlignJustifyIcon />,
  },
];

export const getFilteredOperators = (word: string) =>
  OPERATORS_WITH_ICONS.filter((o) =>
    o.operator.toLowerCase().startsWith(word.toLowerCase()),
  );

export const getWordOnCursor = (input: string, cursorPosition: number) => {
  const textBeforeCursor = input.slice(0, cursorPosition);
  const textAfterCursor = input.slice(cursorPosition);
  const beforeSpace = textBeforeCursor.lastIndexOf(" ");
  const afterSpace = textAfterCursor.indexOf(" ");
  const start = beforeSpace === -1 ? 0 : beforeSpace + 1;
  const end = afterSpace === -1 ? input.length : cursorPosition + afterSpace;
  return input.slice(start, end);
};

export function useSearchBar(initialQuery: string = "") {
  const [query, setQuery] = useState(initialQuery);
  const [showDropdown, setShowDropdown] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [cursorWord, setCursorWord] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isTouched, setIsTouched] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  const handleFocus = () => {
    setIsFocused(true);
    if (!isTouched) setIsTouched(true);
    setShowDropdown(query === "");
  };

  const handleBlur = () => {
    setIsFocused(false);
    setShowDropdown(false);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    getWordOnCursor: (value: string, position: number) => string,
  ) => {
    const value = e.target.value;
    setQuery(value);
    const currentCursorPosition = e.target.selectionStart ?? 0;
    setCursorPosition(currentCursorPosition);
    const currentWord = getWordOnCursor(value, currentCursorPosition);
    setCursorWord(currentWord);
    const filteredOperators = getFilteredOperators(currentWord);
    setShowDropdown(
      isFocused &&
        (value === "" ||
          (currentWord.length > 0 && filteredOperators.length > 0)),
    );
  };

  const handleOperatorSelect = (operator: (typeof OPERATORS_WITH_ICONS)[0]) => {
    const newQuery =
      query.slice(0, cursorPosition - cursorWord.length) +
      `${operator.operator.toLowerCase()}:""` +
      query.slice(cursorPosition);
    setQuery(newQuery);
    setShowDropdown(false);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPosition =
          cursorPosition - cursorWord.length + operator.operator.length + 2;
        inputRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;
    if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      const syntheticEvent = new KeyboardEvent("keydown", {
        key: e.key,
        bubbles: true,
      });
      commandInputRef.current?.dispatchEvent(syntheticEvent);
    }
  };

  return {
    query,
    setQuery,
    showOperators: showDropdown,
    cursorWord,
    inputRef,
    commandInputRef,
    handleInputChange,
    handleOperatorSelect,
    handleKeyDown,
    handleFocus,
    handleBlur,
  };
}

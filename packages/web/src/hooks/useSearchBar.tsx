import {
  AlignJustifyIcon,
  CircleDashedIcon,
  FolderGit2Icon,
  Heading1Icon,
  UserIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SEARCH_OPERATORS } from "@/core/constants/search";

const OPERATORS_WITH_ICONS = [
  {
    name: "Title",
    operator: SEARCH_OPERATORS[0],
    icon: <Heading1Icon />,
  },
  {
    name: "Author",
    operator: SEARCH_OPERATORS[1],
    icon: <UserIcon />,
  },
  {
    name: "Body",
    operator: SEARCH_OPERATORS[2],
    icon: <AlignJustifyIcon />,
  },
  {
    name: "Issue State",
    operator: SEARCH_OPERATORS[3],
    icon: <CircleDashedIcon />,
  },
  {
    name: "Repository",
    operator: SEARCH_OPERATORS[4],
    icon: <FolderGit2Icon />,
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
  const [cursorX, setCursorX] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const commandRef = useRef<HTMLDivElement>(null);

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
    const input = e.target;
    const currentCursorPosition = input.selectionStart ?? 0;

    // Get input's computed styles
    const inputStyles = window.getComputedStyle(input);
    const paddingLeft = parseFloat(inputStyles.paddingLeft);

    // Get the text up to the cursor
    const textBeforeCursor = input.value.slice(0, currentCursorPosition);

    // Create a temporary span to measure text width
    const span = document.createElement("span");
    span.style.font = inputStyles.font;
    span.style.visibility = "hidden";
    span.style.position = "absolute";
    span.textContent = textBeforeCursor;
    document.body.appendChild(span);

    // Get the actual width of the text plus padding
    const textWidth = span.offsetWidth + paddingLeft;
    document.body.removeChild(span);

    setCursorX(textWidth);

    setQuery(input.value);
    setCursorPosition(currentCursorPosition);
    const currentWord = getWordOnCursor(input.value, currentCursorPosition);
    setCursorWord(currentWord);
    const filteredOperators = getFilteredOperators(currentWord);
    setShowDropdown(
      isFocused &&
        (input.value === "" ||
          (currentWord.length > 0 && filteredOperators.length > 0)),
    );
  };

  // Update CSS variable when dropdown is visible and cursorX changes
  useEffect(() => {
    if (showDropdown && commandRef.current) {
      commandRef.current.style.setProperty("--cursor-x", `${cursorX}px`);
    }
  }, [showDropdown, cursorX]);

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
    showDropdown,
    cursorWord,
    inputRef,
    commandInputRef,
    commandRef,
    handleInputChange,
    handleOperatorSelect,
    handleKeyDown,
    handleFocus,
    handleBlur,
  };
}

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
    ...SEARCH_OPERATORS[0],
    icon: <Heading1Icon />,
  },
  {
    name: "Author",
    ...SEARCH_OPERATORS[1],
    icon: <UserIcon />,
  },
  {
    name: "Body",
    ...SEARCH_OPERATORS[2],
    icon: <AlignJustifyIcon />,
  },
  {
    name: "Issue State",
    ...SEARCH_OPERATORS[3],
    icon: <CircleDashedIcon />,
  },
  {
    name: "Repository",
    ...SEARCH_OPERATORS[4],
    icon: <FolderGit2Icon />,
  },
] as const;

type OperatorWithIcon = (typeof OPERATORS_WITH_ICONS)[number];

export const getFilteredOperators = (word: string) =>
  OPERATORS_WITH_ICONS.filter(
    (o) =>
      o.operator.toLowerCase().startsWith(word.toLowerCase()) ||
      o.name.toLowerCase().startsWith(word.toLowerCase()),
  );

export function useSearchBar(initialQuery: string = "") {
  const [query, setQuery] = useState(initialQuery);
  const [showDropdown, setShowDropdown] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [cursorWord, setCursorWord] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  // offset dropdown menu relative to where the user's currently typed word is
  const [menuCursorOffsetX, setMenuCursorOffsetX] = useState(0);

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

  const getCursorWord = (input: string, cursorPosition: number) => {
    const textBeforeCursor = input.slice(0, cursorPosition);
    const textAfterCursor = input.slice(cursorPosition);
    const beforeSpace = textBeforeCursor.lastIndexOf(" ");
    const afterSpace = textAfterCursor.indexOf(" ");
    const start = beforeSpace === -1 ? 0 : beforeSpace + 1;
    const end = afterSpace === -1 ? input.length : cursorPosition + afterSpace;
    return {
      word: input.slice(start, end),
      start,
      end,
    };
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    setQuery(input.value);
    const currentCursorPosition = input.selectionStart ?? 0;
    setCursorPosition(currentCursorPosition);
    const { word, start } = getCursorWord(input.value, currentCursorPosition);
    setCursorWord(word);

    // Get input's computed styles
    const inputStyles = window.getComputedStyle(input);
    const paddingLeft = parseFloat(inputStyles.paddingLeft);

    // Get the text up to the start of the word, this is where dropdown menu should start
    const textBeforeCursor = input.value.slice(0, start);

    // Create a temporary span to measure text width
    const span = document.createElement("span");
    span.style.font = inputStyles.font;
    span.style.visibility = "hidden";
    span.style.position = "absolute";
    span.textContent = textBeforeCursor;
    document.body.appendChild(span);

    // Get the actual width of the text plus padding
    const textWidth = span.offsetWidth + paddingLeft;
    setMenuCursorOffsetX(textWidth);
    document.body.removeChild(span);

    const filteredOperators = getFilteredOperators(word);
    setShowDropdown(
      isFocused &&
        (input.value === "" ||
          (word.length > 0 && filteredOperators.length > 0)),
    );
  };

  // Update CSS variable when dropdown is visible and menuCursorOffsetX changes
  useEffect(() => {
    if (showDropdown && commandRef.current) {
      commandRef.current.style.setProperty(
        "--menu-cursor-offset-x-x",
        `${menuCursorOffsetX}px`,
      );
    }
  }, [showDropdown, menuCursorOffsetX]);

  const getNewQuery = (operator: Omit<OperatorWithIcon, "name" | "icon">) => {
    const newQuery =
      query.slice(0, cursorPosition - cursorWord.length) +
      `${operator.operator.toLowerCase()}:` +
      (operator.enclosedInQuotes ? '""' : "") +
      query.slice(cursorPosition);
    return newQuery;
  };
  const getNewCursorPosition = (
    operator: Omit<OperatorWithIcon, "name" | "icon">,
  ) => {
    // +1 offset for the colon
    // another + 1 for quote if enclosed in quotes
    const offset = operator.enclosedInQuotes ? 2 : 1;
    return (
      cursorPosition - cursorWord.length + operator.operator.length + offset
    );
  };

  const handleOperatorSelect = (operator: OperatorWithIcon) => {
    const newQuery = getNewQuery(operator);
    setQuery(newQuery);
    setShowDropdown(false);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPosition = getNewCursorPosition(operator);
        inputRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  // Forward keyboard events to the command input so that arrows keys and enter key work
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

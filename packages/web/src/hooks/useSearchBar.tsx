import {
  AlignJustifyIcon,
  CircleDashedIcon,
  FolderGit2Icon,
  Heading1Icon,
  UserIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { SEARCH_OPERATORS } from "@/core/constants/search";

export const OPERATORS_WITH_ICONS = [
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

const getCursorWord = (input: string, cursorPosition: number) => {
  const textBeforeCursor = input.slice(0, cursorPosition);
  const textAfterCursor = input.slice(cursorPosition);
  const beforeSpace = textBeforeCursor.lastIndexOf(" ");
  const afterSpace = textAfterCursor.indexOf(" ");
  const start = beforeSpace === -1 ? 0 : beforeSpace + 1;
  const end = afterSpace === -1 ? input.length : cursorPosition + afterSpace;

  return {
    cursorWord: input.slice(start, end),
    start,
  };
};

const getNewQuery = (
  operator: Omit<OperatorWithIcon, "name" | "icon">,
  query: string,
  cursorPosition: number,
  cursorWord: string,
) => {
  const newQuery =
    query.slice(0, cursorPosition - cursorWord.length) +
    `${operator.operator.toLowerCase()}:` +
    (operator.enclosedInQuotes ? '""' : "") +
    query.slice(cursorPosition);
  return newQuery;
};
const getNewCursorPosition = (
  operator: Omit<OperatorWithIcon, "name" | "icon">,
  cursorPosition: number,
  cursorWord: string,
) => {
  // +1 offset for the colon
  // another + 1 for quote if enclosed in quotes
  const offset = operator.enclosedInQuotes ? 2 : 1;
  return cursorPosition - cursorWord.length + operator.operator.length + offset;
};
export function useSearchBar(initialQuery: string = "") {
  const [query, setQuery] = useState(initialQuery);

  const [showDropdown, setShowDropdown] = useState(false);

  const [cursorPosition, setCursorPosition] = useState(0);
  // const [cursorWord, setCursorWord] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  // offset dropdown menu relative to where the user's currently typed word is
  const [menuCursorOffsetX, setMenuCursorOffsetX] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const commandRef = useRef<HTMLDivElement>(null);

  const cursorWord = useMemo(() => {
    return getCursorWord(query, cursorPosition).cursorWord;
  }, [query, cursorPosition]);
  const shouldShowDropdown = useMemo(() => {
    const filteredOperators = getFilteredOperators(cursorWord);
    // true if cursor is at beginning or after a whitespace
    return (
      showDropdown &&
      isFocused &&
      isTouched &&
      (query === "" || cursorWord === "" || filteredOperators.length > 0)
    );
  }, [showDropdown, isFocused, isTouched, query, cursorWord]);

  const handleFocus = () => {
    setIsFocused(true);
    if (!isTouched) setIsTouched(true);
    setShowDropdown(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setShowDropdown(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    setQuery(input.value);
    const currentCursorPosition = input.selectionStart ?? 0;
    const { start } = getCursorWord(input.value, currentCursorPosition);
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
  };

  // Update CSS variable when dropdown is visible and menuCursorOffsetX changes
  useEffect(() => {
    if (shouldShowDropdown && commandRef.current) {
      commandRef.current.style.setProperty(
        "--menu-cursor-offset-x",
        `${menuCursorOffsetX}px`,
      );
    }
  }, [shouldShowDropdown, menuCursorOffsetX]);

  const handleOperatorSelect = (operator: OperatorWithIcon) => {
    const newQuery = getNewQuery(operator, query, cursorPosition, cursorWord);
    setQuery(newQuery);
    // setTimeout is necessary to set cursor position AFTER the rendering is done
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPosition = getNewCursorPosition(
          operator,
          cursorPosition,
          cursorWord,
        );
        inputRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  // Forward keyboard events to the command input so that arrows keys and enter key work
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // if (!showDropdown) return;
    if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      const syntheticEvent = new KeyboardEvent("keydown", {
        key: e.key,
        bubbles: true,
      });
      commandInputRef.current?.dispatchEvent(syntheticEvent);
    }
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setCursorPosition(event.currentTarget.selectionStart ?? 0);
  };

  const handleClear = () => {
    setQuery("");
  };

  return {
    query,
    cursorWord,
    inputRef,
    commandInputRef,
    commandRef,
    shouldShowDropdown,
    handleClear,
    handleInputChange,
    handleOperatorSelect,
    handleKeyDown,
    handleKeyUp,
    handleFocus,
    handleBlur,
    cursorPosition,
  };
}

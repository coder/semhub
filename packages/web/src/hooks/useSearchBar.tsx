import {
  AlignJustifyIcon,
  CircleDashedIcon,
  CircleIcon,
  CircleXIcon,
  FolderGit2Icon,
  Heading1Icon,
  UserIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { SEARCH_OPERATORS, SearchOperator } from "@/core/constants/search";

import { useCursorPosition } from "./useCursorPosition";

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

export type OperatorWithIcon = (typeof OPERATORS_WITH_ICONS)[number];

export interface SubmenuValue {
  name: string;
  value: string;
  icon: React.ReactNode;
}

export const OPERATOR_SUBMENU_VALUES = new Map<SearchOperator, SubmenuValue[]>([
  [
    SEARCH_OPERATORS[3].operator, // "state"
    [
      { name: "Open", value: "open", icon: <CircleIcon /> },
      { name: "Closed", value: "closed", icon: <CircleXIcon /> },
    ],
  ],
]);

export const getFilteredOperators = (word: string) =>
  OPERATORS_WITH_ICONS.filter(
    (o) =>
      o.operator.toLowerCase().startsWith(word.toLowerCase()) ||
      o.name.toLowerCase().startsWith(word.toLowerCase()),
  );

export const getFilteredSubmenuValues = (
  word: string,
  subMenu: SearchOperator | null,
) => {
  if (!subMenu) return [];
  const submenuValues = OPERATOR_SUBMENU_VALUES.get(subMenu);
  if (!submenuValues) return [];
  return submenuValues.filter(
    (s) =>
      s.name.toLowerCase().startsWith(word.toLowerCase()) ||
      s.value.toLowerCase().startsWith(word.toLowerCase()),
  );
};

const getCursorWord = (input: string, cursorPosition: number) => {
  const textBeforeCursor = input.slice(0, cursorPosition);
  const textAfterCursor = input.slice(cursorPosition);

  // Trim only the text before cursor to preserve spaces after cursor
  const beforeSpace = textBeforeCursor.trimStart().lastIndexOf(" ");
  const afterSpace = textAfterCursor.indexOf(" ");

  // Adjust start position to account for leading spaces
  const leadingSpaces =
    textBeforeCursor.length - textBeforeCursor.trimStart().length;
  const start =
    beforeSpace === -1 ? leadingSpaces : leadingSpaces + beforeSpace + 1;
  const end = afterSpace === -1 ? input.length : cursorPosition + afterSpace;

  const cursorWord = input.slice(start, end);
  return {
    cursorWord,
    start,
  };
};

const getOpSelectQuery = (
  operator: Pick<OperatorWithIcon, "operator" | "enclosedInQuotes">,
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

const getValSelectQuery = (
  val: Pick<SubmenuValue, "value">,
  query: string,
  cursorPosition: number,
  commandInputValue: string,
) => {
  const newQuery =
    query.slice(0, cursorPosition - commandInputValue.length) +
    val.value +
    query.slice(cursorPosition);
  return newQuery;
};

const getOpSelectCursorPosition = (
  operator: Pick<OperatorWithIcon, "operator" | "enclosedInQuotes">,
  cursorPosition: number,
  cursorWord: string,
) => {
  // +1 offset for the colon
  // another + 1 for quote if enclosed in quotes
  const offset = operator.enclosedInQuotes ? 2 : 1;
  return cursorPosition - cursorWord.length + operator.operator.length + offset;
};

const getValSelectCursorPosition = (
  value: string,
  cursorPosition: number,
  commandInputValue: string,
) => {
  return cursorPosition - commandInputValue.length + value.length;
};

export function useSearchBar(initialQuery = "") {
  const [query, setQuery] = useState(initialQuery);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const commandRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const { cursorPosition, setCursorPosition } = useCursorPosition(inputRef);

  const [isFocused, setIsFocused] = useState(false);
  const [isTouched, setIsTouched] = useState(false);

  const cursorWord = useMemo(() => {
    return getCursorWord(query, cursorPosition).cursorWord;
  }, [query, cursorPosition]);

  const subMenu = useMemo(() => {
    if (!cursorWord || !cursorWord.includes(":")) return null;
    const op = cursorWord.slice(0, cursorWord.indexOf(":")).toLowerCase();
    const val = cursorWord.slice(cursorWord.indexOf(":") + 1).toLowerCase();
    const matchedOp = SEARCH_OPERATORS.find(
      ({ operator }) => operator === op,
    )?.operator;
    // user has not fully typed an operator, show main menu
    if (!matchedOp) return null;
    const matchedVal = OPERATOR_SUBMENU_VALUES.get(matchedOp)?.find(
      ({ value }) => value.toLowerCase() === val,
    );
    // user has not fully typed an operator's submenu value, show submenu for autocomplete
    if (!matchedVal) return matchedOp;
    // finally, revert to main menu when operator's submenu value is fully typed
    return null;
  }, [cursorWord]);

  const commandInputValue = useMemo(() => {
    // default menu to show
    if (!subMenu) return cursorWord;
    const sliceLength = subMenu.length + 1; // +1 for the colon
    return cursorWord.slice(sliceLength);
  }, [cursorWord, subMenu]);

  const shouldShowDropdown = useMemo(() => {
    const relevantList = subMenu
      ? getFilteredSubmenuValues(commandInputValue, subMenu)
      : getFilteredOperators(commandInputValue);
    // true if cursor is at beginning or after a whitespace
    return (
      showDropdown &&
      isFocused &&
      isTouched &&
      (query === "" || commandInputValue === "" || relevantList.length > 0)
    );
  }, [showDropdown, isFocused, isTouched, query, commandInputValue, subMenu]);

  // offset dropdown menu relative to where the user's currently typed word is
  const [menuCursorOffsetX, setMenuCursorOffsetX] = useState(0);
  // Update CSS variable when dropdown is visible and menuCursorOffsetX changes
  useEffect(() => {
    if (shouldShowDropdown && commandRef.current) {
      commandRef.current.style.setProperty(
        "--menu-cursor-offset-x",
        `${menuCursorOffsetX}px`,
      );
    }
  }, [shouldShowDropdown, menuCursorOffsetX]);

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
    setCursorPosition(currentCursorPosition);
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

  const handleOperatorSelect = (operator: OperatorWithIcon) => {
    const newQuery = getOpSelectQuery(
      operator,
      query,
      cursorPosition,
      cursorWord,
    );
    setQuery(newQuery);
    // setTimeout is necessary to set cursor position AFTER the rendering is done
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPosition = getOpSelectCursorPosition(
          operator,
          cursorPosition,
          cursorWord,
        );
        inputRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  const handleValueSelect = (val: SubmenuValue) => {
    const newQuery = getValSelectQuery(
      val,
      query,
      cursorPosition,
      commandInputValue,
    );
    setQuery(newQuery);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPosition = getValSelectCursorPosition(
          val.value,
          cursorPosition,
          commandInputValue,
        );
        inputRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  // Forward keyboard events to the command input so that arrows keys and enter key work
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // when dropdown is not visible, don't forward events. important for Enter to continue to work
    if (!shouldShowDropdown) return;
    if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      const syntheticEvent = new KeyboardEvent("keydown", {
        key: e.key,
        bubbles: true,
      });
      commandInputRef.current?.dispatchEvent(syntheticEvent);
    }
  };

  const handleClear = () => {
    setQuery("");
  };

  return {
    query,
    inputRef,
    commandInputRef,
    commandRef,
    commandInputValue,
    subMenu,
    shouldShowDropdown,
    handleClear,
    handleInputChange,
    handleOperatorSelect,
    handleValueSelect,
    handleKeyDown,
    handleFocus,
    handleBlur,
  };
}

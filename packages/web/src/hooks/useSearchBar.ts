import { useEffect, useMemo, useRef, useState } from "react";

import {
  SEARCH_OPERATORS,
  type SearchOperator,
} from "@/core/constants/search.constant";
import type {
  OperatorWithIcon,
  SubmenuValue,
} from "@/components/search/SearchDropdownMenu";
import {
  getFilteredOperators,
  getFilteredSubmenuValues,
  OPERATOR_SUBMENU_VALUES,
} from "@/components/search/SearchDropdownMenu";

import { useCursorPosition } from "./useCursorPosition";

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

interface UseSearchBarProps {
  initialQuery?: string;
  removedOperators?: SearchOperator[];
}

export const DEFAULT_COMMAND_VALUE = "__no_selection__";

export function useSearchBar({
  initialQuery = "",
  removedOperators = [],
}: UseSearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const commandRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const { cursorPosition, setCursorPosition } = useCursorPosition(inputRef);

  const [isFocused, setIsFocused] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  const [commandValue, setCommandValue] = useState(DEFAULT_COMMAND_VALUE);

  const searchOperators = useMemo(() => {
    return SEARCH_OPERATORS.filter(
      (op) => !removedOperators.includes(op.operator),
    );
  }, [removedOperators]);

  const cursorWord = useMemo(() => {
    return getCursorWord(query, cursorPosition).cursorWord;
  }, [query, cursorPosition]);

  const subMenu = useMemo(() => {
    if (!cursorWord || !cursorWord.includes(":")) return null;
    const op = cursorWord.slice(0, cursorWord.indexOf(":")).toLowerCase();
    const val = cursorWord.slice(cursorWord.indexOf(":") + 1).toLowerCase();
    const matchedOp = searchOperators.find(
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
  }, [cursorWord, searchOperators]);

  const commandInputValue = useMemo(() => {
    // default menu to show
    if (!subMenu) return cursorWord;
    const sliceLength = subMenu.length + 1; // +1 for the colon
    return cursorWord.slice(sliceLength);
  }, [cursorWord, subMenu]);

  const shouldShowDropdown = useMemo(() => {
    const showOperatorList =
      !subMenu &&
      getFilteredOperators(commandInputValue, removedOperators).length > 0;
    const showSubmenuList =
      subMenu &&
      getFilteredSubmenuValues(commandInputValue, subMenu).length > 0;
    return (
      showDropdown &&
      isFocused &&
      isTouched &&
      (showOperatorList || showSubmenuList)
    );
  }, [showDropdown, isFocused, isTouched, commandInputValue, subMenu]);

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

  const isSelectingRef = useRef(false);

  const handleBlur = () => {
    setTimeout(() => {
      if (!isSelectingRef.current) {
        setIsFocused(false);
        setShowDropdown(false);
      }
      isSelectingRef.current = false;
    }, 100);
  };

  const updateCursorPosition = (newPosition: number) => {
    setCursorPosition(newPosition);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    setQuery(input.value);
    setCursorPosition(input.selectionStart ?? 0);
    // Move the cursor offset calculation here
    const { start } = getCursorWord(input.value, input.selectionStart ?? 0);
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
    isSelectingRef.current = true;
    const newQuery = getOpSelectQuery(
      operator,
      query,
      cursorPosition,
      cursorWord,
    );
    setQuery(newQuery);
    // wait for newQuery to update before setting cursor position
    const newPosition = getOpSelectCursorPosition(
      operator,
      cursorPosition,
      cursorWord,
    );
    updateCursorPosition(newPosition);
  };

  const handleValueSelect = (val: SubmenuValue) => {
    isSelectingRef.current = true;
    const newQuery = getValSelectQuery(
      val,
      query,
      cursorPosition,
      commandInputValue,
    );
    setQuery(newQuery);
    const newPosition = getValSelectCursorPosition(
      val.value,
      cursorPosition,
      commandInputValue,
    );
    updateCursorPosition(newPosition);
  };

  // Forward keyboard events to the command input so that arrows keys and enter key work
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle command input forwarding first
    if (shouldShowDropdown) {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        // Forward the event to command input
        const syntheticEvent = new KeyboardEvent("keydown", {
          key: e.key,
          bubbles: true,
        });
        commandInputRef.current?.dispatchEvent(syntheticEvent);
        return;
      }

      if (e.key === "Enter") {
        if (commandValue !== DEFAULT_COMMAND_VALUE) {
          e.preventDefault();
          const syntheticEvent = new KeyboardEvent("keydown", {
            key: e.key,
            bubbles: true,
          });
          commandInputRef.current?.dispatchEvent(syntheticEvent);
        } else {
          setIsFocused(false);
          setShowDropdown(false);
        }
        return;
      }
    }

    const input = e.currentTarget;
    const currentCursorPosition = input.selectionStart ?? 0;

    const notSelectingText = input.selectionStart === input.selectionEnd;
    // Only handle custom backspace if there's no text selection
    // Don't modify alt+backspace behavior
    if (e.key === "Backspace" && notSelectingText && !e.altKey) {
      e.preventDefault();
      const newValue = handleBackspace(input.value, currentCursorPosition);
      setQuery(newValue);
      const newPosition = currentCursorPosition - 1;
      updateCursorPosition(newPosition);
      return;
    }

    if (notSelectingText && (e.key === '"' || e.key === "“" || e.key === "”")) {
      e.preventDefault();
      // If the key pressed is a smart quote, replace it with a regular quote
      // NB at this point of rendering, neither value nor cursorPosition have changed
      const { newValue, newCursorPosition } = handleQuotationMark(
        input.value,
        currentCursorPosition,
        cursorWord,
      );
      setQuery(newValue);
      updateCursorPosition(newCursorPosition);
    }
  };

  const handleClear = () => {
    setQuery("");
  };

  return {
    query,
    setQuery,
    inputRef,
    commandInputRef,
    commandRef,
    commandInputValue,
    commandValue,
    setCommandValue,
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

function handleBackspace(
  inputValue: string,
  currentCursorPosition: number,
): string {
  const nextChar = inputValue.charAt(currentCursorPosition);
  const lastChar = inputValue.charAt(currentCursorPosition - 1);

  // If deleting an opening quote with a matching closing quote, remove both
  if (lastChar === '"' && nextChar === '"') {
    return (
      inputValue.slice(0, currentCursorPosition - 1) +
      inputValue.slice(currentCursorPosition + 1)
    );
  }
  return (
    inputValue.slice(0, currentCursorPosition - 1) +
    inputValue.slice(currentCursorPosition)
  );
}

function handleQuotationMark(
  prevInput: string,
  prevCursorPosition: number,
  cursorWord: string,
): {
  newValue: string;
  newCursorPosition: number;
} {
  const candidateNewValue =
    prevInput.slice(0, prevCursorPosition) +
    '"' +
    prevInput.slice(prevCursorPosition);
  const nextChar = candidateNewValue.charAt(prevCursorPosition + 1);

  // If next character is a quote, skip over it and don't insert the current quote
  if (nextChar === '"') {
    return {
      newValue: prevInput,
      newCursorPosition: prevCursorPosition + 1,
    };
  }
  // Auto-insert closing quote only if we're at the end of a word
  // or if there's only whitespace after the cursor
  const textAfterCursor = prevInput.slice(prevCursorPosition + 1);
  const isAtWordBoundary = !cursorWord || /^\s*$/.test(textAfterCursor);
  if (isAtWordBoundary) {
    return {
      newValue:
        prevInput.slice(0, prevCursorPosition) +
        '""' +
        prevInput.slice(prevCursorPosition),
      newCursorPosition: prevCursorPosition + 1,
    };
  }

  return {
    newValue: candidateNewValue,
    newCursorPosition: prevCursorPosition + 1,
  };
}

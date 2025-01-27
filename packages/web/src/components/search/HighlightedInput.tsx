import * as React from "react";
import { useMemo } from "react";

import {
  SEARCH_OPERATORS,
  SearchOperator,
} from "@/core/constants/search.constant";
import { cn } from "@/lib/utils";

// component inspired by https://akashhamirwasia.com/blog/building-highlighted-input-field-in-react/
// with significant modifications
const HighlightedInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "value"> & {
    value: string;
    removedOperators?: SearchOperator[];
  }
>(({ className, type, value, removedOperators = [], ...props }, ref) => {
  const rendererRef = React.useRef<HTMLDivElement>(null);

  const filteredSearchOperators = useMemo(() => {
    return SEARCH_OPERATORS.filter(
      (op) => !removedOperators.includes(op.operator),
    );
  }, [removedOperators]);

  // Create regex pattern from filtered search operators that captures both operator and value
  const operatorRegex = useMemo(() => {
    return new RegExp(
      `(${filteredSearchOperators.map(({ operator }) => `${operator}:`).join("|")})(?:"([^"]*)"|([^\\s]*))`,
      "g",
    );
  }, [filteredSearchOperators]);

  const syncScroll = (e: React.UIEvent<HTMLInputElement>) => {
    if (rendererRef.current) {
      rendererRef.current.scrollTop = e.currentTarget.scrollTop;
      rendererRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // Extract padding classes from className
  const paddingClasses = className?.match(/(p[ltrbxy]-\d+)/g) || [];
  // Common text styling classes to ensure exact matching
  const textStyles =
    "font-sans text-[16px] leading-normal tracking-normal font-normal";

  const inputWithHighlights = useMemo(() => {
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = operatorRegex.exec(value)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push({
          text: value.slice(lastIndex, match.index),
          type: "text",
        });
      }

      // Add operator
      parts.push({
        text: match[1], // The operator with colon
        type: "operator",
      });

      // Add value (including quotes if present)
      if (match[0] && match[1]) {
        const valueWithQuotes = match[0].slice(match[1].length); // Get everything after the operator
        parts.push({
          text: valueWithQuotes,
          type: "value",
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < value.length) {
      parts.push({
        text: value.slice(lastIndex),
        type: "text",
      });
    }

    return parts;
  }, [value, operatorRegex]);

  const renderedContent = useMemo(() => {
    return inputWithHighlights.map((part, i) => (
      <span
        key={i}
        className={
          part.type === "operator"
            ? "text-blue-600 dark:text-blue-400"
            : part.type === "value"
              ? "text-orange-500"
              : undefined
        }
      >
        {part.text}
      </span>
    ));
  }, [inputWithHighlights]);

  return (
    <div className="relative">
      <input
        type={type}
        className={cn(
          textStyles,
          "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          "text-transparent caret-slate-950 dark:caret-white", // make text transparent, but retain caret color
          className,
        )}
        ref={ref}
        value={value}
        onScroll={syncScroll}
        {...props}
      />
      <div
        ref={rendererRef}
        className={cn(
          textStyles,
          "scrollbar-none pointer-events-none absolute inset-0 flex items-center overflow-x-auto whitespace-pre px-3 py-2",
          ...paddingClasses,
        )}
      >
        {renderedContent}
      </div>
    </div>
  );
});
HighlightedInput.displayName = "HighlightedInput";

export { HighlightedInput };

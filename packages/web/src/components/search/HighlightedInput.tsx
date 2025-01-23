import * as React from "react";
import { useMemo } from "react";

import {
  SEARCH_OPERATORS,
  SearchOperator,
} from "@/core/constants/search.constant";
import { cn } from "@/lib/utils";

// component inspired by https://akashhamirwasia.com/blog/building-highlighted-input-field-in-react/
const HighlightedInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "value"> & {
    value: string;
    removedOperators?: SearchOperator[];
  }
>(({ className, type, value, removedOperators = [], ...props }, ref) => {
  const rendererRef = React.useRef<HTMLDivElement>(null);

  const searchOperators = useMemo(() => {
    return SEARCH_OPERATORS.filter(
      (op) => !removedOperators.includes(op.operator),
    );
  }, [removedOperators]);

  // Create regex pattern from filtered search operators
  const operatorRegex = useMemo(() => {
    return new RegExp(
      `(${searchOperators.map(({ operator }) => `${operator}:`).join("|")})`,
      "g",
    );
  }, [searchOperators]);

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
        {value.split(operatorRegex).map((part, i) => {
          const isOperator = part.match(operatorRegex);
          return (
            <span key={i} className={isOperator ? "text-blue-600" : undefined}>
              {part}
            </span>
          );
        })}
      </div>
    </div>
  );
});
HighlightedInput.displayName = "HighlightedInput";

export { HighlightedInput };

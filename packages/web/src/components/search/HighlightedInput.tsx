import * as React from "react";
import { useMemo } from "react";

import type { SearchOperator } from "@/core/constants/search.constant";
import { cn } from "@/lib/utils";
import { useOperatorHighlighting } from "@/hooks/useOperatorHighlighting";

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
  const highlightedParts = useOperatorHighlighting(value, removedOperators);

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

  const renderedContent = useMemo(() => {
    return highlightedParts.map((part, i) => (
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
  }, [highlightedParts]);

  return (
    <div className="relative">
      <input
        type={type}
        className={cn(
          textStyles,
          "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          "text-transparent caret-slate-950 dark:caret-white", // make text transparent, but retain caret color
          "[&::-ms-clear]:hidden [&::-webkit-search-cancel-button]:hidden", // hide browser's default clear button in search inputs
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

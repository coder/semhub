import { useMemo } from "react";

import type { SearchOperator } from "@/core/constants/search.constant";
import { SEARCH_OPERATORS } from "@/core/constants/search.constant";

export type HighlightPart = {
  text: string;
  type: "text" | "operator" | "value";
};

export function useOperatorHighlighting(
  text: string,
  removedOperators: SearchOperator[] = [],
) {
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

  return useMemo(() => {
    const parts: HighlightPart[] = [];
    let lastIndex = 0;
    let match;

    while ((match = operatorRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push({
          text: text.slice(lastIndex, match.index),
          type: "text",
        });
      }

      const operator = match[1];
      if (!operator) continue;

      // Add operator
      parts.push({
        text: operator,
        type: "operator",
      });

      // Add value (including quotes if present)
      const valueWithQuotes = match[0].slice(operator.length); // Get everything after the operator
      parts.push({
        text: valueWithQuotes,
        type: "value",
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        text: text.slice(lastIndex),
        type: "text",
      });
    }

    return parts;
  }, [text, operatorRegex]);
}

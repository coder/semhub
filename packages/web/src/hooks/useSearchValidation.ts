import { useState } from "react";

import { searchQuerySchema } from "@/core/semsearch/schema.input";

export const useSearchValidation = () => {
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const validateSearch = (query: string) => {
    const result = searchQuerySchema.safeParse(query);
    if (!result.success) {
      setValidationErrors(result.error.issues.map((issue) => issue.message));
      return false;
    }
    return true;
  };

  const clearValidationErrors = () => {
    setValidationErrors([]);
  };

  return {
    validationErrors,
    validateSearch,
    clearValidationErrors,
  };
};

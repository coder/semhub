/**
 * Sanitizes strings to ensure PostgreSQL UTF-8 compatibility.
 * PostgreSQL expects valid UTF-8 sequences and this function removes or replaces
 * problematic characters that could cause insertion errors.
 */
export function sanitizeForPg(str: string): string {
  // Step 1: Remove null bytes
  let sanitized = str.replace(/\u0000/g, "");

  // Step 2: Remove other problematic control characters
  sanitized = sanitized.replace(
    /[\u0001-\u0008\u000B-\u000C\u000E-\u001F]/g,
    "",
  );

  // Step 3: Remove Unicode replacement character and non-characters
  sanitized = sanitized.replace(/[\uFFFD\uFFFE\uFFFF]/g, "");

  // Step 4: Handle surrogate pairs
  sanitized = sanitized.replace(
    /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g,
    (match) => {
      // Keep valid surrogate pairs, remove incomplete ones
      return match.length === 2 ? match : "";
    },
  );

  // Step 5: Replace any remaining invalid UTF-8 sequences with spaces
  sanitized = sanitized.replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, " ");

  return sanitized;
}

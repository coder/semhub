/**
 * Restores data types from JSON stringified data, particularly useful for dates
 * and numbers before running zod validation. Handles nested objects and arrays.
 * Preserves null values in nested objects.
 */
export function restoreTypes<T extends object>(data: T): T {
  if (!data || typeof data !== "object") return data;

  const restored = { ...data };
  for (const [key, value] of Object.entries(restored)) {
    if (value === null) {
      continue; // preserve null values
    } else if (typeof value === "string") {
      // Try to parse ISO date strings
      const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      if (dateRegex.test(value)) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          (restored as any)[key] = date;
          continue;
        }
      }
      // Try to parse numbers
      const numberValue = Number(value);
      if (!isNaN(numberValue) && String(numberValue) === value) {
        (restored as any)[key] = numberValue;
      }
    } else if (Array.isArray(value)) {
      (restored as any)[key] = value.map((item) =>
        item === null
          ? null
          : typeof item === "object"
            ? restoreTypes(item)
            : item,
      );
    } else if (value && typeof value === "object") {
      (restored as any)[key] = restoreTypes(value);
    }
  }

  return restored;
}

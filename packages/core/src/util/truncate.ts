export function truncateToByteSize(text: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  let encoded = encoder.encode(text);

  if (encoded.length <= maxBytes) {
    return text;
  }

  // Binary search to find the right cut-off point
  let left = 0;
  let right = text.length;

  while (left < right) {
    const mid = Math.floor((left + right + 1) / 2);
    const slice = text.slice(0, mid);

    if (encoder.encode(slice).length <= maxBytes) {
      left = mid;
    } else {
      right = mid - 1;
    }
  }

  return text.slice(0, left) + "\n\n[Content truncated due to size limit...]";
}

export function truncateCodeBlocks(
  text: string,
  numLinesAtStartAndEnd: number,
): string {
  // Match:
  // 1. Three backticks
  // 2. Optional language identifier
  // 3. Newline
  // 4. Any content (including newlines) until
  // 5. Three backticks on a line (possibly with whitespace)
  const CODE_BLOCK_REGEX = /```[a-z]*\n[\s\S]*?\n\s*```/g;
  return text.replace(CODE_BLOCK_REGEX, (match) => {
    const lines = match.split("\n");
    if (lines.length <= numLinesAtStartAndEnd * 2) return match;

    const firstLine = lines[0]; // ```language
    const lastLine = lines[lines.length - 1]; // ```

    return [
      firstLine,
      ...lines.slice(1, numLinesAtStartAndEnd + 1),
      "\n// [...truncated...]\n",
      ...lines.slice(-numLinesAtStartAndEnd - 1, -1),
      lastLine,
    ].join("\n");
  });
}

export function chunkArray<T>(array: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, index) =>
    array.slice(index * size, (index + 1) * size),
  );
}

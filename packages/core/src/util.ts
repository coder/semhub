export function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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

export function truncateCodeBlocks(text: string): string {
  const CODE_BLOCK_PREVIEW_LINES = 10;
  // Match:
  // 1. Three backticks
  // 2. Optional language identifier
  // 3. Newline
  // 4. Any content (including newlines) until
  // 5. Three backticks on a line (possibly with whitespace)
  const CODE_BLOCK_REGEX = /```[a-z]*\n[\s\S]*?\n\s*```/g;
  return text.replace(CODE_BLOCK_REGEX, (match) => {
    const lines = match.split("\n");
    if (lines.length <= CODE_BLOCK_PREVIEW_LINES * 2) return match;

    const firstLine = lines[0]; // ```language
    const lastLine = lines[lines.length - 1]; // ```

    return [
      firstLine,
      ...lines.slice(1, CODE_BLOCK_PREVIEW_LINES + 1),
      "\n// [...truncated...]\n",
      ...lines.slice(-CODE_BLOCK_PREVIEW_LINES - 1, -1),
      lastLine,
    ].join("\n");
  });
}

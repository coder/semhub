export function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

import { describe, expect, it } from "vitest";

import { truncateCodeBlocks } from "./util";

describe("truncateCodeBlocks", () => {
  it("should not modify text without code blocks", () => {
    const text =
      "This is regular text\nwith multiple lines\nbut no code blocks";
    expect(truncateCodeBlocks(text)).toBe(text);
  });

  it("should not modify small code blocks", () => {
    const text = `Here's a small block:
\`\`\`typescript
const a = 1;
const b = 2;
const c = 3;
\`\`\`
End of block`;
    expect(truncateCodeBlocks(text)).toBe(text);
  });

  it("should truncate large code blocks", () => {
    const lines = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`);
    const text = `Before
\`\`\`typescript
${lines.join("\n")}
\`\`\`
After`;

    const result = truncateCodeBlocks(text);

    // Should contain first 10 lines
    expect(result).toContain("line 1");
    expect(result).toContain("line 10");

    // Should contain last 10 lines
    expect(result).toContain("line 21");
    expect(result).toContain("line 30");

    // Should contain truncation marker
    expect(result).toContain("// [...truncated...]");

    // Should preserve language identifier
    expect(result).toContain("```typescript");
  });

  it("should handle multiple code blocks", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
    const text = `First block:
\`\`\`typescript
${lines.join("\n")}
\`\`\`
Some text in between
\`\`\`javascript
${lines.join("\n")}
\`\`\`
End`;

    const result = truncateCodeBlocks(text);

    // Should contain two truncation markers
    expect(result.match(/\[\.\.\.truncated\.\.\.\]/g)?.length).toBe(2);

    // Should preserve both language identifiers
    expect(result).toContain("```typescript");
    expect(result).toContain("```javascript");
  });

  it("should handle code blocks without language specification", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
    const text = `\`\`\`
${lines.join("\n")}
\`\`\``;

    const result = truncateCodeBlocks(text);
    expect(result).toContain("```\n");
    expect(result).toContain("// [...truncated...]");
  });

  it("should preserve text outside code blocks", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
    const text = `Before text
with multiple lines
\`\`\`
${lines.join("\n")}
\`\`\`
After text
with multiple lines`;

    const result = truncateCodeBlocks(text);
    expect(result).toContain("Before text\nwith multiple lines");
    expect(result).toContain("After text\nwith multiple lines");
  });
});

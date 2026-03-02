import { describe, it, expect } from "vitest";

/**
 * Bug: Entering text edit mode in TiptapTextEditor adds an extra empty line
 * at the bottom that can't be removed with backspace.
 *
 * Root cause: getInitialContent() converts plain text to Tiptap JSON using
 * split("\n"). When the plain text ends with "\n", split produces a trailing
 * empty string. The logic adds a hardBreak before that empty entry but skips
 * the text node (because the string is falsy). The trailing hardBreak renders
 * as a <br> — an extra empty line.
 *
 * Example: "Hello\n" → split → ["Hello", ""]
 *   i=0: push text("Hello")
 *   i=1: push hardBreak, skip empty text
 *   Result: [text("Hello"), hardBreak]  ← trailing hardBreak = phantom line
 */

// Extract the logic under test (mirrors getInitialContent from TiptapTextEditor)
function getInitialContentBuggy(initialContent: string): Record<string, unknown> {
  const lines = initialContent.split("\n");
  const content: Record<string, unknown>[] = [];
  lines.forEach((line, i) => {
    if (i > 0) {
      content.push({ type: "hardBreak" });
    }
    if (line) {
      content.push({ type: "text", text: line });
    }
  });
  return { type: "doc", content };
}

// The fixed version (to be implemented)
function getInitialContentFixed(initialContent: string): Record<string, unknown> {
  // Strip trailing newlines — they produce phantom empty lines as trailing hardBreaks
  const trimmed = initialContent.replace(/\n+$/, "");
  if (!trimmed) {
    return { type: "doc", content: [] };
  }
  const lines = trimmed.split("\n");
  const content: Record<string, unknown>[] = [];
  lines.forEach((line, i) => {
    if (i > 0) {
      content.push({ type: "hardBreak" });
    }
    if (line) {
      content.push({ type: "text", text: line });
    }
  });
  return { type: "doc", content };
}

describe("getInitialContent trailing newline bug", () => {
  describe("BUG: trailing newline produces a trailing hardBreak", () => {
    it("single trailing newline adds a phantom hardBreak", () => {
      const result = getInitialContentBuggy("Hello\n");
      const content = result.content as Record<string, unknown>[];

      // The last node is a hardBreak — this is the bug
      expect(content[content.length - 1]).toEqual({ type: "hardBreak" });
      // Should only have text("Hello"), but buggy version has [text, hardBreak]
      expect(content).toEqual([
        { type: "text", text: "Hello" },
        { type: "hardBreak" },
      ]);
    });

    it("trailing newline after multiline adds a phantom hardBreak", () => {
      const result = getInitialContentBuggy("Hello\nWorld\n");
      const content = result.content as Record<string, unknown>[];

      // Last node is a hardBreak — the extra empty line
      expect(content[content.length - 1]).toEqual({ type: "hardBreak" });
    });

    it("multiple trailing newlines add multiple phantom hardBreaks", () => {
      const result = getInitialContentBuggy("Hello\n\n");
      const content = result.content as Record<string, unknown>[];

      // Two trailing hardBreaks
      expect(content).toEqual([
        { type: "text", text: "Hello" },
        { type: "hardBreak" },
        { type: "hardBreak" },
      ]);
    });
  });

  describe("FIX: trailing newlines should be stripped", () => {
    it("single trailing newline does NOT produce a trailing hardBreak", () => {
      const result = getInitialContentFixed("Hello\n");
      const content = result.content as Record<string, unknown>[];

      expect(content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("multiline with trailing newline preserves internal breaks only", () => {
      const result = getInitialContentFixed("Hello\nWorld\n");
      const content = result.content as Record<string, unknown>[];

      expect(content).toEqual([
        { type: "text", text: "Hello" },
        { type: "hardBreak" },
        { type: "text", text: "World" },
      ]);
    });

    it("multiple trailing newlines are all stripped", () => {
      const result = getInitialContentFixed("Hello\n\n\n");
      const content = result.content as Record<string, unknown>[];

      expect(content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("content without trailing newline is unchanged", () => {
      const result = getInitialContentFixed("Hello\nWorld");
      const content = result.content as Record<string, unknown>[];

      expect(content).toEqual([
        { type: "text", text: "Hello" },
        { type: "hardBreak" },
        { type: "text", text: "World" },
      ]);
    });

    it("single line without newline is unchanged", () => {
      const result = getInitialContentFixed("Hello");
      const content = result.content as Record<string, unknown>[];

      expect(content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("empty string produces empty content", () => {
      const result = getInitialContentFixed("");
      const content = result.content as Record<string, unknown>[];

      expect(content).toEqual([]);
    });

    it("only newlines produces empty content", () => {
      const result = getInitialContentFixed("\n\n\n");
      const content = result.content as Record<string, unknown>[];

      expect(content).toEqual([]);
    });

    it("internal blank lines (double newlines) are preserved", () => {
      const result = getInitialContentFixed("Hello\n\nWorld");
      const content = result.content as Record<string, unknown>[];

      // Two newlines in the middle = two hardBreaks (blank line between paragraphs)
      expect(content).toEqual([
        { type: "text", text: "Hello" },
        { type: "hardBreak" },
        { type: "hardBreak" },
        { type: "text", text: "World" },
      ]);
    });
  });
});

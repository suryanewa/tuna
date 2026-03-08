import { describe, it, expect } from "vitest";
import { camelToKebab, truncate } from "../utils";

describe("camelToKebab", () => {
  it("converts camelCase to kebab-case", () => {
    expect(camelToKebab("fontSize")).toBe("font-size");
    expect(camelToKebab("borderTopWidth")).toBe("border-top-width");
    expect(camelToKebab("backgroundColor")).toBe("background-color");
  });

  it("handles single word", () => {
    expect(camelToKebab("color")).toBe("color");
    expect(camelToKebab("display")).toBe("display");
  });

  it("handles vendor prefixes", () => {
    expect(camelToKebab("webkitLineClamp")).toBe("-webkit-line-clamp");
    expect(camelToKebab("webkitBoxOrient")).toBe("-webkit-box-orient");
    expect(camelToKebab("mozAppearance")).toBe("-moz-appearance");
    expect(camelToKebab("msFlexAlign")).toBe("-ms-flex-align");
  });
});

describe("truncate", () => {
  it("returns short strings unchanged", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates long strings with ellipsis", () => {
    expect(truncate("hello world foo bar", 11)).toBe("hello world\u2026");
  });

  it("collapses whitespace", () => {
    expect(truncate("hello   world", 20)).toBe("hello world");
    expect(truncate("  hello  world  ", 20)).toBe("hello world");
  });

  it("handles empty strings", () => {
    expect(truncate("", 10)).toBe("");
  });
});

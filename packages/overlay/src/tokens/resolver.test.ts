import { describe, it, expect, vi } from "vitest";

// Mock scanDesignTokens before importing resolver
vi.mock("../inspector/tokens", () => ({
  scanDesignTokens: vi.fn(() => ({
    tokens: [
      { name: "--spacing-1", value: "4px", source: ":root" },
      { name: "--spacing-2", value: "8px", source: ":root" },
      { name: "--spacing-4", value: "16px", source: ":root" },
      { name: "--color-brand", value: "#2563eb", source: ":root" },
      { name: "--color-text", value: "#1c1917", source: ":root" },
      { name: "--radius-md", value: "8px", source: ":root" },
      { name: "--radius-lg", value: "12px", source: ":root" },
      { name: "--font-sm", value: "14px", source: ":root" },
      { name: "--shadow-md", value: "0 4px 6px -1px rgba(0,0,0,0.1)", source: ":root" },
      { name: "--size-lg", value: "48px", source: ":root" },
    ],
    valueToTokens: new Map(),
  })),
}));

// Mock registry to return empty (picker only shows CSS variables now)
vi.mock("./registry", () => ({
  getTokenRegistry: vi.fn(() => ({
    groups: new Map(),
    valueLookup: new Map(),
    classLookup: new Map(),
    framework: "unknown",
  })),
}));

import { getTokensForProperty, hasTokensForProperty, resolveTokensForElement } from "./resolver";

describe("Variable picker — getTokensForProperty", () => {
  it("returns only CSS variables for spacing (no class tokens)", () => {
    const tokens = getTokensForProperty("padding");
    expect(tokens.length).toBe(3); // --spacing-1, --spacing-2, --spacing-4
    expect(tokens.every(t => t.className.startsWith("var("))).toBe(true);
  });

  it("returns CSS variables for colors", () => {
    const tokens = getTokensForProperty("color");
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.map(t => t.className)).toContain("var(--color-brand)");
    expect(tokens.map(t => t.className)).toContain("var(--color-text)");
  });

  it("returns CSS variables for borders (radius)", () => {
    const tokens = getTokensForProperty("borderRadius");
    expect(tokens.map(t => t.className)).toContain("var(--radius-md)");
    expect(tokens.map(t => t.className)).toContain("var(--radius-lg)");
  });

  it("returns CSS variables for typography", () => {
    const tokens = getTokensForProperty("fontSize");
    expect(tokens.map(t => t.className)).toContain("var(--font-sm)");
  });

  it("returns CSS variables for effects", () => {
    const tokens = getTokensForProperty("boxShadow");
    expect(tokens.map(t => t.className)).toContain("var(--shadow-md)");
  });

  it("returns CSS variables for sizing", () => {
    const tokens = getTokensForProperty("width");
    expect(tokens.map(t => t.className)).toContain("var(--size-lg)");
  });

  it("returns empty for uncategorized properties", () => {
    expect(getTokensForProperty("zIndex").length).toBe(0);
  });
});

describe("hasTokensForProperty — only checks CSS variables", () => {
  it("returns true when CSS variables exist for the category", () => {
    expect(hasTokensForProperty("padding")).toBe(true);
    expect(hasTokensForProperty("color")).toBe(true);
    expect(hasTokensForProperty("borderRadius")).toBe(true);
  });

  it("returns false for uncategorized properties", () => {
    expect(hasTokensForProperty("zIndex")).toBe(false);
  });
});

describe("resolveTokensForElement — detects var() in applied styles", () => {
  function mockElement(
    iteratedProps: Record<string, string>,
    options: { classes?: string[]; shorthandValues?: Record<string, string> } = {},
  ): Element {
    const { classes = [], shorthandValues = {} } = options;
    const allValues = { ...iteratedProps, ...shorthandValues };
    const iterKeys = Object.keys(iteratedProps);

    const styleObj = {
      length: iterKeys.length,
      item: (i: number) => iterKeys[i],
      getPropertyValue: (prop: string) => allValues[prop] || "",
    };

    return {
      classList: classes,
      style: styleObj,
      matches: () => false,
    } as unknown as Element;
  }

  it("detects var(--color-brand) in inline color", () => {
    const el = mockElement({ color: "var(--color-brand)" });
    const matches = resolveTokensForElement(el, { color: "#2563eb" });
    expect(matches.has("color")).toBe(true);
    expect(matches.get("color")!.token.className).toBe("var(--color-brand)");
  });

  it("detects var(--font-sm) in inline font-size", () => {
    const el = mockElement({ "font-size": "var(--font-sm)" });
    const matches = resolveTokensForElement(el, { fontSize: "14px" });
    expect(matches.has("font-size")).toBe(true);
    expect(matches.get("font-size")!.token.className).toBe("var(--font-sm)");
  });

  it("returns no matches for element without var() usage", () => {
    const el = mockElement({ padding: "16px" });
    const matches = resolveTokensForElement(el, { padding: "16px" });
    expect(matches.size).toBe(0);
  });

  it("returns no matches for unknown CSS variables", () => {
    const el = mockElement({ color: "var(--unknown-var)" });
    const matches = resolveTokensForElement(el, { color: "#abc" });
    expect(matches.size).toBe(0);
  });

  it("detects multiple var() properties on same element", () => {
    const el = mockElement({
      color: "var(--color-brand)",
      "font-size": "var(--font-sm)",
    });
    const matches = resolveTokensForElement(el, {
      color: "#2563eb",
      fontSize: "14px",
    });
    expect(matches.size).toBe(2);
    expect(matches.get("color")!.token.className).toBe("var(--color-brand)");
    expect(matches.get("font-size")!.token.className).toBe("var(--font-sm)");
  });

  it("detects shorthand padding: var() expanded to longhands", () => {
    const el = mockElement(
      { "padding-top": "", "padding-right": "", "padding-bottom": "", "padding-left": "" },
      { shorthandValues: { padding: "var(--spacing-4)" } },
    );
    const matches = resolveTokensForElement(el, { paddingTop: "16px" });
    expect(matches.has("padding-top")).toBe(true);
    expect(matches.has("padding-right")).toBe(true);
    expect(matches.has("padding-bottom")).toBe(true);
    expect(matches.has("padding-left")).toBe(true);
    expect(matches.get("padding-top")!.token.className).toBe("var(--spacing-4)");
  });

  it("detects shorthand border-radius: var() expanded to longhands", () => {
    const el = mockElement(
      { "border-top-left-radius": "", "border-top-right-radius": "", "border-bottom-right-radius": "", "border-bottom-left-radius": "" },
      { shorthandValues: { "border-radius": "var(--radius-md)" } },
    );
    const matches = resolveTokensForElement(el, { borderRadius: "8px" });
    expect(matches.has("border-top-left-radius")).toBe(true);
    expect(matches.get("border-top-left-radius")!.token.className).toBe("var(--radius-md)");
  });

  it("detects shorthand gap: var() expanded to longhands", () => {
    const el = mockElement(
      { "row-gap": "", "column-gap": "" },
      { shorthandValues: { gap: "var(--spacing-4)" } },
    );
    const matches = resolveTokensForElement(el, { gap: "16px" });
    expect(matches.has("row-gap")).toBe(true);
    expect(matches.has("column-gap")).toBe(true);
    expect(matches.get("row-gap")!.token.className).toBe("var(--spacing-4)");
  });
});

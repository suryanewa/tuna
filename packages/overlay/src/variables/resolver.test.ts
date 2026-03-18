import { describe, it, expect, vi, beforeEach } from "vitest";

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
      // Variables with non-standard names (for usage-based categorization tests)
      { name: "--heading-size", value: "2rem", source: ":root" },
      { name: "--brand", value: "#3b82f6", source: ":root" },
      { name: "--lh-tight", value: "1.25", source: ":root" },
      // Space-separated RGB (Tailwind v4 pattern)
      { name: "--color-peach", value: "255 229 202", source: ":root" },
      // Framework internals (should be filtered)
      { name: "--tw-ring-offset-color", value: "#fff", source: ":root" },
      { name: "--tw-shadow", value: "0 0 #0000", source: ":root" },
      { name: "--chakra-ring-color", value: "rgba(66,153,225,0.6)", source: ":root" },
    ],
    valueToTokens: new Map(),
  })),
}));

// Mock registry with class-based color tokens
vi.mock("./registry", () => ({
  getVariableRegistry: vi.fn(() => ({
    groups: new Map([
      ["colors", [
        { className: "bg-blue-500", values: { "background-color": "#3b82f6" }, layerName: "utilities" },
        { className: "bg-red-500", values: { "background-color": "#ef4444" }, layerName: "utilities" },
        { className: "text-blue-500", values: { "color": "#3b82f6" }, layerName: "utilities" },
      ]],
    ]),
    valueLookup: new Map(),
    classLookup: new Map(),
    framework: "tailwind",
  })),
}));

import { getVariablesForProperty, hasVariablesForProperty, resolveVariablesForElement, invalidateCssVariables, isSpaceSeparatedRgb } from "./resolver";

describe("Variable picker — getVariablesForProperty", () => {
  it("returns only CSS variables for spacing (no class tokens)", () => {
    const tokens = getVariablesForProperty("padding");
    expect(tokens.length).toBe(4); // --spacing-1, --spacing-2, --spacing-4, --heading-size (value fallback: "2rem" → spacing)
    expect(tokens.every(t => t.className.startsWith("var("))).toBe(true);
  });

  it("returns CSS variables and class tokens for colors", () => {
    const tokens = getVariablesForProperty("color");
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.map(t => t.className)).toContain("var(--color-brand)");
    expect(tokens.map(t => t.className)).toContain("var(--color-text)");
    expect(tokens.map(t => t.className)).toContain("text-blue-500");
  });

  it("returns CSS variables for border-radius", () => {
    const tokens = getVariablesForProperty("borderRadius");
    expect(tokens.map(t => t.className)).toContain("var(--radius-md)");
    expect(tokens.map(t => t.className)).toContain("var(--radius-lg)");
  });

  it("returns CSS variables for typography", () => {
    const tokens = getVariablesForProperty("fontSize");
    expect(tokens.map(t => t.className)).toContain("var(--font-sm)");
  });

  it("returns CSS variables for box-shadow", () => {
    const tokens = getVariablesForProperty("boxShadow");
    expect(tokens.map(t => t.className)).toContain("var(--shadow-md)");
  });

  it("returns CSS variables for sizing", () => {
    const tokens = getVariablesForProperty("width");
    expect(tokens.map(t => t.className)).toContain("var(--size-lg)");
  });

  it("returns empty for uncategorized properties", () => {
    expect(getVariablesForProperty("zIndex").length).toBe(0);
  });
});

describe("hasVariablesForProperty — only checks CSS variables", () => {
  it("returns true when CSS variables exist for the category", () => {
    expect(hasVariablesForProperty("padding")).toBe(true);
    expect(hasVariablesForProperty("color")).toBe(true);
    expect(hasVariablesForProperty("borderRadius")).toBe(true);
  });

  it("returns false for uncategorized properties", () => {
    expect(hasVariablesForProperty("zIndex")).toBe(false);
  });
});

describe("resolveVariablesForElement — detects var() in applied styles", () => {
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
    const matches = resolveVariablesForElement(el, { color: "#2563eb" });
    expect(matches.has("color")).toBe(true);
    expect(matches.get("color")!.variable.className).toBe("var(--color-brand)");
  });

  it("detects var(--font-sm) in inline font-size", () => {
    const el = mockElement({ "font-size": "var(--font-sm)" });
    const matches = resolveVariablesForElement(el, { fontSize: "14px" });
    expect(matches.has("font-size")).toBe(true);
    expect(matches.get("font-size")!.variable.className).toBe("var(--font-sm)");
  });

  it("returns no matches for element without var() usage", () => {
    const el = mockElement({ padding: "16px" });
    const matches = resolveVariablesForElement(el, { padding: "16px" });
    expect(matches.size).toBe(0);
  });

  it("returns no matches for unknown CSS variables", () => {
    const el = mockElement({ color: "var(--unknown-var)" });
    const matches = resolveVariablesForElement(el, { color: "#abc" });
    expect(matches.size).toBe(0);
  });

  it("detects multiple var() properties on same element", () => {
    const el = mockElement({
      color: "var(--color-brand)",
      "font-size": "var(--font-sm)",
    });
    const matches = resolveVariablesForElement(el, {
      color: "#2563eb",
      fontSize: "14px",
    });
    expect(matches.size).toBe(2);
    expect(matches.get("color")!.variable.className).toBe("var(--color-brand)");
    expect(matches.get("font-size")!.variable.className).toBe("var(--font-sm)");
  });

  it("detects shorthand padding: var() expanded to longhands", () => {
    const el = mockElement(
      { "padding-top": "", "padding-right": "", "padding-bottom": "", "padding-left": "" },
      { shorthandValues: { padding: "var(--spacing-4)" } },
    );
    const matches = resolveVariablesForElement(el, { paddingTop: "16px" });
    expect(matches.has("padding-top")).toBe(true);
    expect(matches.has("padding-right")).toBe(true);
    expect(matches.has("padding-bottom")).toBe(true);
    expect(matches.has("padding-left")).toBe(true);
    expect(matches.get("padding-top")!.variable.className).toBe("var(--spacing-4)");
  });

  it("detects shorthand border-radius: var() expanded to longhands", () => {
    const el = mockElement(
      { "border-top-left-radius": "", "border-top-right-radius": "", "border-bottom-right-radius": "", "border-bottom-left-radius": "" },
      { shorthandValues: { "border-radius": "var(--radius-md)" } },
    );
    const matches = resolveVariablesForElement(el, { borderRadius: "8px" });
    expect(matches.has("border-top-left-radius")).toBe(true);
    expect(matches.get("border-top-left-radius")!.variable.className).toBe("var(--radius-md)");
  });

  it("detects shorthand gap: var() expanded to longhands", () => {
    const el = mockElement(
      { "row-gap": "", "column-gap": "" },
      { shorthandValues: { gap: "var(--spacing-4)" } },
    );
    const matches = resolveVariablesForElement(el, { gap: "16px" });
    expect(matches.has("row-gap")).toBe(true);
    expect(matches.has("column-gap")).toBe(true);
    expect(matches.get("row-gap")!.variable.className).toBe("var(--spacing-4)");
  });

  it("tryClear: inline raw value after var shorthand clears the var match", () => {
    // Simulate realistic browser order: shorthand longhands iterated first (from shorthand),
    // then a separate inline property overrides one longhand.
    // First element has shorthand var for all padding:
    const el1 = mockElement(
      { "padding-top": "", "padding-right": "", "padding-bottom": "", "padding-left": "" },
      { shorthandValues: { padding: "var(--spacing-4)" } },
    );
    const matches1 = resolveVariablesForElement(el1, { paddingTop: "16px" });
    expect(matches1.has("padding-right")).toBe(true); // var from shorthand

    // Second element: same shorthand but padding-right has a raw inline override
    // In real browsers, the raw longhand appears in style.item() AFTER shorthand expansion
    // and getPropertyValue returns the raw value for that specific longhand
    const el2 = mockElement(
      {
        "padding-top": "var(--spacing-4)",
        "padding-right": "40px",  // raw override
        "padding-bottom": "var(--spacing-4)",
        "padding-left": "var(--spacing-4)",
      },
    );
    const matches2 = resolveVariablesForElement(el2, { paddingTop: "16px", paddingRight: "40px" });
    expect(matches2.has("padding-top")).toBe(true);
    expect(matches2.has("padding-right")).toBe(false); // cleared by tryClear
    expect(matches2.has("padding-bottom")).toBe(true);
    expect(matches2.has("padding-left")).toBe(true);
  });

  it("tryClear: does not clear when value contains var()", () => {
    const el = mockElement({
      color: "var(--color-brand)",
      "font-size": "var(--font-sm)",
    });
    const matches = resolveVariablesForElement(el, { color: "#2563eb", fontSize: "14px" });
    // Both should have var matches (tryClear skips var() values)
    expect(matches.has("color")).toBe(true);
    expect(matches.has("font-size")).toBe(true);
  });

  it("tryClear: does not clear on empty value", () => {
    // Simulate: shorthand expansion artifact where longhand has empty value
    const el = mockElement(
      { "padding-top": "", "padding-right": "", "padding-bottom": "", "padding-left": "" },
      { shorthandValues: { padding: "var(--spacing-4)" } },
    );
    const matches = resolveVariablesForElement(el, { paddingTop: "16px" });
    // All should have var matches (empty strings don't trigger tryClear)
    expect(matches.has("padding-top")).toBe(true);
    expect(matches.has("padding-right")).toBe(true);
    expect(matches.has("padding-bottom")).toBe(true);
    expect(matches.has("padding-left")).toBe(true);
  });
});

// ── Usage-based categorization tests ──

/** Helper: create a mock CSSStyleRule that passes instanceof checks */
function mockStyleRule(selector: string, properties: Record<string, string>): CSSStyleRule {
  const entries = Object.entries(properties);
  const cssText = `${selector} { ${entries.map(([k, v]) => `${k}: ${v}`).join("; ")} }`;

  const rule = Object.create(CSSStyleRule.prototype);
  rule.selectorText = selector;
  rule.cssText = cssText;
  rule.style = {
    length: entries.length,
    item: (i: number) => entries[i]?.[0] ?? "",
    getPropertyValue: (prop: string) => {
      const entry = entries.find(([k]) => k === prop);
      return entry ? entry[1] : "";
    },
  };
  return rule as CSSStyleRule;
}

/** Helper: set up mock document.styleSheets with given rules */
function mockStyleSheets(rules: CSSStyleRule[]) {
  (document as any).styleSheets = [{ cssRules: rules }];
}

// Ensure DOM globals exist for usage-based tests (vitest has no DOM by default)
if (typeof globalThis.document === "undefined") {
  (globalThis as any).document = { styleSheets: [] };
}
if (typeof globalThis.CSSStyleRule === "undefined") {
  (globalThis as any).CSSStyleRule = class CSSStyleRule {};
  (globalThis as any).CSSGroupingRule = class CSSGroupingRule {};
}

describe("Usage-based variable categorization", () => {
  beforeEach(() => {
    invalidateCssVariables();
  });

  it("categorizes --heading-size as font-size when used in font-size property", () => {
    mockStyleSheets([
      mockStyleRule(".heading", { "font-size": "var(--heading-size)" }),
    ]);
    const vars = getVariablesForProperty("fontSize");
    expect(vars.map(v => v.className)).toContain("var(--heading-size)");
  });

  it("categorizes --brand as colors when used in color/background-color", () => {
    mockStyleSheets([
      mockStyleRule(".brand-text", { color: "var(--brand)" }),
      mockStyleRule(".brand-bg", { "background-color": "var(--brand)" }),
    ]);
    const vars = getVariablesForProperty("color");
    expect(vars.map(v => v.className)).toContain("var(--brand)");
  });

  it("categorizes --lh-tight as line-height when used in line-height property", () => {
    mockStyleSheets([
      mockStyleRule(".tight", { "line-height": "var(--lh-tight)" }),
    ]);
    const vars = getVariablesForProperty("lineHeight");
    expect(vars.map(v => v.className)).toContain("var(--lh-tight)");
  });

  it("usage-based categorization overrides name-based when they conflict", () => {
    // --font-sm would be categorized as "font-size" by name patterns,
    // but if it's actually used as a spacing value, usage wins
    mockStyleSheets([
      // No rules using --heading-size as font-size, but one using --brand in color
      mockStyleRule(".x", { color: "var(--brand)" }),
    ]);
    const colorVars = getVariablesForProperty("color");
    expect(colorVars.map(v => v.className)).toContain("var(--brand)");
    // --brand should NOT appear in font-size
    const fontVars = getVariablesForProperty("fontSize");
    expect(fontVars.map(v => v.className)).not.toContain("var(--brand)");
  });

  it("falls back to name patterns when variable has no stylesheet usage", () => {
    // --spacing-4 matches name pattern for spacing even with empty stylesheets
    mockStyleSheets([]);
    const vars = getVariablesForProperty("padding");
    expect(vars.map(v => v.className)).toContain("var(--spacing-4)");
  });

  it("handles var() inside calc() expressions", () => {
    mockStyleSheets([
      mockStyleRule(".calc-test", { "font-size": "calc(var(--heading-size) * 1.5)" }),
    ]);
    const vars = getVariablesForProperty("fontSize");
    expect(vars.map(v => v.className)).toContain("var(--heading-size)");
  });

  it("consistent category when variable used in same-category properties", () => {
    mockStyleSheets([
      mockStyleRule(".a", { "padding-top": "var(--spacing-4)" }),
      mockStyleRule(".b", { gap: "var(--spacing-4)" }),
      mockStyleRule(".c", { "margin-left": "var(--spacing-4)" }),
    ]);
    const vars = getVariablesForProperty("padding");
    expect(vars.map(v => v.className)).toContain("var(--spacing-4)");
  });
});

describe("isSpaceSeparatedRgb — detects space-separated RGB channels", () => {
  it("detects valid space-separated RGB", () => {
    expect(isSpaceSeparatedRgb("255 229 202")).toBe(true);
    expect(isSpaceSeparatedRgb("0 0 0")).toBe(true);
    expect(isSpaceSeparatedRgb("128 64 32")).toBe(true);
    expect(isSpaceSeparatedRgb("  255  229  202  ")).toBe(true);
  });

  it("rejects non-RGB values", () => {
    expect(isSpaceSeparatedRgb("#ff0000")).toBe(false);
    expect(isSpaceSeparatedRgb("rgb(255, 0, 0)")).toBe(false);
    expect(isSpaceSeparatedRgb("16px")).toBe(false);
    expect(isSpaceSeparatedRgb("hello world foo")).toBe(false);
    expect(isSpaceSeparatedRgb("256 0 0")).toBe(false);
    expect(isSpaceSeparatedRgb("255 0")).toBe(false);
    expect(isSpaceSeparatedRgb("")).toBe(false);
  });

  it("normalizes space-separated RGB into colors category", () => {
    mockStyleSheets([]);
    invalidateCssVariables();
    const vars = getVariablesForProperty("color");
    expect(vars.map(v => v.className)).toContain("var(--color-peach)");
    // Verify the value was normalized to rgb() format
    const peach = vars.find(v => v.className === "var(--color-peach)");
    expect(peach).toBeDefined();
    expect(peach!.values["--color-peach"]).toBe("rgb(255, 229, 202)");
  });
});

describe("Framework internal filtering", () => {
  beforeEach(() => {
    invalidateCssVariables();
    mockStyleSheets([]);
  });

  it("filters out --tw-* variables", () => {
    const allVars = [
      ...getVariablesForProperty("color"),
      ...getVariablesForProperty("boxShadow"),
      ...getVariablesForProperty("padding"),
    ];
    const classNames = allVars.map(v => v.className);
    expect(classNames).not.toContain("var(--tw-ring-offset-color)");
    expect(classNames).not.toContain("var(--tw-shadow)");
  });

  it("filters out --chakra-* variables", () => {
    const allVars = getVariablesForProperty("color");
    const classNames = allVars.map(v => v.className);
    expect(classNames).not.toContain("var(--chakra-ring-color)");
  });

  it("does not filter user-defined variables", () => {
    const vars = getVariablesForProperty("color");
    const classNames = vars.map(v => v.className);
    expect(classNames).toContain("var(--color-brand)");
    expect(classNames).toContain("var(--color-text)");
  });
});

describe("getVariablesForProperty — includes class tokens", () => {
  beforeEach(() => {
    invalidateCssVariables();
    mockStyleSheets([]);
  });

  it("includes class-based color tokens for background-color", () => {
    const vars = getVariablesForProperty("backgroundColor");
    expect(vars.map(v => v.className)).toContain("bg-blue-500");
    expect(vars.map(v => v.className)).toContain("bg-red-500");
  });

  it("filters class tokens by property (bg-* for background-color, text-* for color)", () => {
    const bgVars = getVariablesForProperty("backgroundColor");
    const textVars = getVariablesForProperty("color");
    expect(bgVars.map(v => v.className)).toContain("bg-blue-500");
    expect(bgVars.map(v => v.className)).not.toContain("text-blue-500");
    expect(textVars.map(v => v.className)).toContain("text-blue-500");
    expect(textVars.map(v => v.className)).not.toContain("bg-blue-500");
  });

  it("returns both class tokens and CSS variables", () => {
    const vars = getVariablesForProperty("backgroundColor");
    const hasClassToken = vars.some(v => v.className === "bg-blue-500");
    const hasCssVar = vars.some(v => v.className.startsWith("var("));
    expect(hasClassToken).toBe(true);
    expect(hasCssVar).toBe(true);
  });

  it("does not include class tokens for non-color properties", () => {
    const vars = getVariablesForProperty("padding");
    expect(vars.every(v => v.className.startsWith("var("))).toBe(true);
  });
});

import { describe, it, expect } from "vitest";

/**
 * Tests for ComponentSection auto-filtering logic.
 * These test the filtering functions directly (extracted from ComponentSection.tsx).
 */

// ── Replicate the filtering logic for testing ──

const ALWAYS_HIDE_PROPS = new Set([
  "children", "ref", "key", "className", "style", "params", "searchParams",
  "dangerouslySetInnerHTML",
]);

const HIDE_NAME_PATTERNS = [
  /^on[A-Z]/,
  /^__/,
  /^\$/,
  /^_/,
  /^data-/,
  /^aria-/,
  /^(?:i13n|ylk|track|beacon)/i,
];

const FRAMEWORK_COMPONENT_PATTERNS = [
  /Provider$/i,
  /Context$/i,
  /Config$/i,
  /Wrapper$/i,
  /^HOC/i,
  /^with[A-Z]/,
  /^I13n/i,
  /^Motion/i,
  /^Suspense$/,
  /^ErrorBoundary$/i,
];

function isDesignerRelevantProp(name: string, value: unknown): boolean {
  if (ALWAYS_HIDE_PROPS.has(name)) return false;
  for (const pattern of HIDE_NAME_PATTERNS) {
    if (pattern.test(name)) return false;
  }
  if (typeof value === "function") return false;
  if (value === null || value === undefined) return false;
  if (typeof value === "object") return false;
  if (typeof value === "string" && value.length > 80) return false;
  return true;
}

function isFrameworkComponent(name: string | null): boolean {
  if (!name) return false;
  return FRAMEWORK_COMPONENT_PATTERNS.some(p => p.test(name));
}

function isHiddenByCondition(
  hiddenUnless: Record<string, unknown> | undefined,
  currentProps: Record<string, unknown> | null,
): boolean {
  if (!hiddenUnless || !currentProps) return false;
  for (const [depProp, requiredValue] of Object.entries(hiddenUnless)) {
    const actual = currentProps[depProp];
    if (actual !== requiredValue) return true;
  }
  return false;
}

// ── Tests ──

describe("isDesignerRelevantProp", () => {
  // Props that SHOULD show
  it("shows simple string props", () => {
    expect(isDesignerRelevantProp("label", "Click me")).toBe(true);
    expect(isDesignerRelevantProp("title", "Hello")).toBe(true);
    expect(isDesignerRelevantProp("placeholder", "Enter text")).toBe(true);
  });

  it("shows boolean props", () => {
    expect(isDesignerRelevantProp("disabled", false)).toBe(true);
    expect(isDesignerRelevantProp("isOpen", true)).toBe(true);
    expect(isDesignerRelevantProp("loading", false)).toBe(true);
  });

  it("shows number props", () => {
    expect(isDesignerRelevantProp("size", 24)).toBe(true);
    expect(isDesignerRelevantProp("count", 3)).toBe(true);
    expect(isDesignerRelevantProp("tabIndex", 0)).toBe(true);
  });

  it("shows enum-like string props", () => {
    expect(isDesignerRelevantProp("variant", "primary")).toBe(true);
    expect(isDesignerRelevantProp("size", "md")).toBe(true);
  });

  // Props that SHOULD be hidden
  it("hides event handlers", () => {
    expect(isDesignerRelevantProp("onClick", () => {})).toBe(false);
    expect(isDesignerRelevantProp("onChange", () => {})).toBe(false);
    expect(isDesignerRelevantProp("onSubmit", () => {})).toBe(false);
  });

  it("hides always-skip props", () => {
    expect(isDesignerRelevantProp("children", "text")).toBe(false);
    expect(isDesignerRelevantProp("ref", {})).toBe(false);
    expect(isDesignerRelevantProp("key", "item-1")).toBe(false);
    expect(isDesignerRelevantProp("className", "btn")).toBe(false);
    expect(isDesignerRelevantProp("style", {})).toBe(false);
    expect(isDesignerRelevantProp("dangerouslySetInnerHTML", {})).toBe(false);
  });

  it("hides internal props", () => {
    expect(isDesignerRelevantProp("__source", {})).toBe(false);
    expect(isDesignerRelevantProp("__self", null)).toBe(false);
    expect(isDesignerRelevantProp("_private", "test")).toBe(false);
    expect(isDesignerRelevantProp("$type", "div")).toBe(false);
  });

  it("hides data and aria attributes", () => {
    expect(isDesignerRelevantProp("data-testid", "btn")).toBe(false);
    expect(isDesignerRelevantProp("data-ylk", "{}")).toBe(false);
    expect(isDesignerRelevantProp("aria-label", "Close")).toBe(false);
    expect(isDesignerRelevantProp("aria-hidden", true)).toBe(false);
  });

  it("hides analytics props", () => {
    expect(isDesignerRelevantProp("i13nModel", {})).toBe(false);
    expect(isDesignerRelevantProp("ylkData", "{}")).toBe(false);
    expect(isDesignerRelevantProp("trackingId", "abc")).toBe(false);
    expect(isDesignerRelevantProp("beaconType", "view")).toBe(false);
  });

  it("hides functions", () => {
    expect(isDesignerRelevantProp("render", () => {})).toBe(false);
    expect(isDesignerRelevantProp("getItems", () => {})).toBe(false);
  });

  it("hides objects and arrays", () => {
    expect(isDesignerRelevantProp("config", { type: "spring" })).toBe(false);
    expect(isDesignerRelevantProp("items", [1, 2, 3])).toBe(false);
    expect(isDesignerRelevantProp("transition", { duration: 300 })).toBe(false);
  });

  it("hides null and undefined", () => {
    expect(isDesignerRelevantProp("value", null)).toBe(false);
    expect(isDesignerRelevantProp("value", undefined)).toBe(false);
  });

  it("hides long strings (likely serialized data)", () => {
    const longString = "a".repeat(81);
    expect(isDesignerRelevantProp("data", longString)).toBe(false);
  });

  it("shows strings up to 80 chars", () => {
    const shortString = "a".repeat(80);
    expect(isDesignerRelevantProp("label", shortString)).toBe(true);
  });
});

describe("isFrameworkComponent", () => {
  it("hides provider components", () => {
    expect(isFrameworkComponent("ThemeProvider")).toBe(true);
    expect(isFrameworkComponent("AuthProvider")).toBe(true);
    expect(isFrameworkComponent("StoreProvider")).toBe(true);
  });

  it("hides context components", () => {
    expect(isFrameworkComponent("ThemeContext")).toBe(true);
    expect(isFrameworkComponent("AppContext")).toBe(true);
  });

  it("hides config components", () => {
    expect(isFrameworkComponent("MotionConfig")).toBe(true);
    expect(isFrameworkComponent("AnimationConfig")).toBe(true);
  });

  it("hides wrapper and HOC components", () => {
    expect(isFrameworkComponent("PageWrapper")).toBe(true);
    expect(isFrameworkComponent("HOCAuth")).toBe(true);
    expect(isFrameworkComponent("withTheme")).toBe(true);
    expect(isFrameworkComponent("withRouter")).toBe(true);
  });

  it("hides analytics components", () => {
    expect(isFrameworkComponent("I13nAnchor")).toBe(true);
    expect(isFrameworkComponent("I13nButton")).toBe(true);
  });

  it("hides React internals", () => {
    expect(isFrameworkComponent("Suspense")).toBe(true);
    expect(isFrameworkComponent("ErrorBoundary")).toBe(true);
  });

  it("shows visual components", () => {
    expect(isFrameworkComponent("Button")).toBe(false);
    expect(isFrameworkComponent("Card")).toBe(false);
    expect(isFrameworkComponent("Modal")).toBe(false);
    expect(isFrameworkComponent("Dropdown")).toBe(false);
    expect(isFrameworkComponent("Avatar")).toBe(false);
    expect(isFrameworkComponent("ProsCons")).toBe(false);
    expect(isFrameworkComponent("ProductCard")).toBe(false);
  });

  it("handles null", () => {
    expect(isFrameworkComponent(null)).toBe(false);
  });
});

describe("isHiddenByCondition (hidden_unless)", () => {
  it("shows prop when condition is met", () => {
    expect(isHiddenByCondition(
      { variant: "outline" },
      { variant: "outline", size: "md" },
    )).toBe(false);
  });

  it("hides prop when condition is not met", () => {
    expect(isHiddenByCondition(
      { variant: "outline" },
      { variant: "solid", size: "md" },
    )).toBe(true);
  });

  it("handles multiple conditions (all must match)", () => {
    expect(isHiddenByCondition(
      { variant: "outline", hasIcon: true },
      { variant: "outline", hasIcon: true },
    )).toBe(false);

    expect(isHiddenByCondition(
      { variant: "outline", hasIcon: true },
      { variant: "outline", hasIcon: false },
    )).toBe(true);
  });

  it("returns false when no condition", () => {
    expect(isHiddenByCondition(undefined, { variant: "solid" })).toBe(false);
  });

  it("returns false when no current props", () => {
    expect(isHiddenByCondition({ variant: "outline" }, null)).toBe(false);
  });

  it("hides when dependent prop is missing", () => {
    expect(isHiddenByCondition(
      { variant: "outline" },
      { size: "md" }, // variant not present
    )).toBe(true);
  });
});

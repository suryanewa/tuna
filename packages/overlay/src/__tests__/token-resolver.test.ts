import { describe, it, expect, vi } from "vitest";
import type { UtilityToken, TokenRegistry, TokenCategory } from "../tokens/types";

// ---------------------------------------------------------------------------
// Mock the token registry at module scope (hoisted by vitest)
// ---------------------------------------------------------------------------
const spacingTokens: UtilityToken[] = [
  // Raw utilities (should be excluded by getAlternativeTokens)
  { className: "p-1", values: { padding: "0.25rem" }, layerName: "utilities" },
  { className: "p-2", values: { padding: "0.5rem" }, layerName: "utilities" },
  { className: "p-4", values: { padding: "1rem" }, layerName: "utilities" },
  // Semantic tokens (should be included)
  { className: "spacing-sm", values: { padding: "0.5rem" }, layerName: "components" },
  { className: "spacing-md", values: { padding: "1rem" }, layerName: "components" },
  { className: "spacing-lg", values: { padding: "1.5rem" }, layerName: "components" },
  // Token that affects a different property (should be excluded)
  { className: "gap-sm", values: { gap: "0.5rem" }, layerName: "components" },
];

const mockRegistry: TokenRegistry = {
  groups: new Map<TokenCategory, UtilityToken[]>([
    ["spacing", spacingTokens],
  ]),
  valueLookup: new Map(),
  classLookup: new Map(),
  framework: "tailwind",
};

vi.mock("../tokens/registry", () => ({
  getTokenRegistry: () => mockRegistry,
}));

// Import after mock declaration so vitest can wire it up
import { isRawUtility, isTailwindUtility, getAlternativeTokens } from "../tokens/resolver";

// ---------------------------------------------------------------------------
// Helper to create a UtilityToken
// ---------------------------------------------------------------------------
function makeToken(
  className: string,
  values: Record<string, string>,
  layerName?: string,
): UtilityToken {
  return { className, values, layerName };
}

// ---------------------------------------------------------------------------
// isRawUtility tests
// ---------------------------------------------------------------------------
describe("isRawUtility", () => {
  // 1. returns true for tokens with layerName "utilities"
  it('returns true for tokens with layerName "utilities"', () => {
    const token = makeToken("p-4", { padding: "1rem" }, "utilities");
    expect(isRawUtility(token)).toBe(true);
  });

  // 2. returns false for tokens with layerName "components"
  it('returns false for tokens with layerName "components"', () => {
    const token = makeToken("btn-primary", { "background-color": "blue" }, "components");
    expect(isRawUtility(token)).toBe(false);
  });

  // 3. returns false for tokens with layerName "base"
  it('returns false for tokens with layerName "base"', () => {
    const token = makeToken("body-text", { "font-size": "16px" }, "base");
    expect(isRawUtility(token)).toBe(false);
  });

  // 4. falls back to regex for tokens with no layerName
  it("falls back to regex for tokens with no layerName", () => {
    // "p-4" matches the legacy regex
    const twToken = makeToken("p-4", { padding: "1rem" });
    expect(isRawUtility(twToken)).toBe(true);
    // "spacing-xl" does NOT match the legacy regex
    const semanticToken = makeToken("spacing-xl", { padding: "2rem" });
    expect(isRawUtility(semanticToken)).toBe(false);
  });

  // 5. regex matches known Tailwind v1/v2 utilities
  it("regex matches known Tailwind v1/v2 utilities (p-4, mt-2, bg-red-500)", () => {
    expect(isRawUtility(makeToken("p-4", { padding: "1rem" }))).toBe(true);
    expect(isRawUtility(makeToken("mt-2", { "margin-top": "0.5rem" }))).toBe(true);
    expect(isRawUtility(makeToken("bg-red-500", { "background-color": "#ef4444" }))).toBe(true);
    expect(isRawUtility(makeToken("text-lg", { "font-size": "1.125rem" }))).toBe(true);
    expect(isRawUtility(makeToken("rounded-md", { "border-radius": "0.375rem" }))).toBe(true);
    expect(isRawUtility(makeToken("shadow-lg", { "box-shadow": "0 10px 15px" }))).toBe(true);
    expect(isRawUtility(makeToken("opacity-50", { opacity: "0.5" }))).toBe(true);
    expect(isRawUtility(makeToken("w-full", { width: "100%" }))).toBe(true);
    expect(isRawUtility(makeToken("h-screen", { height: "100vh" }))).toBe(true);
    expect(isRawUtility(makeToken("gap-4", { gap: "1rem" }))).toBe(true);
    expect(isRawUtility(makeToken("flex-col", { "flex-direction": "column" }))).toBe(true);
    expect(isRawUtility(makeToken("z-50", { "z-index": "50" }))).toBe(true);
    expect(isRawUtility(makeToken("border-2", { "border-width": "2px" }))).toBe(true);
    expect(isRawUtility(makeToken("font-bold", { "font-weight": "700" }))).toBe(true);
    expect(isRawUtility(makeToken("leading-tight", { "line-height": "1.25" }))).toBe(true);
    expect(isRawUtility(makeToken("tracking-wide", { "letter-spacing": "0.025em" }))).toBe(true);
  });

  // 6. regex does NOT match semantic tokens
  it("regex does NOT match semantic tokens (spacing-xl, color-primary)", () => {
    expect(isRawUtility(makeToken("spacing-xl", { padding: "2rem" }))).toBe(false);
    expect(isRawUtility(makeToken("color-primary", { color: "#1d4ed8" }))).toBe(false);
    expect(isRawUtility(makeToken("heading-large", { "font-size": "2rem" }))).toBe(false);
    expect(isRawUtility(makeToken("card-shadow", { "box-shadow": "0 2px 4px rgba(0,0,0,.1)" }))).toBe(false);
    expect(isRawUtility(makeToken("radius-lg", { "border-radius": "12px" }))).toBe(false);
    expect(isRawUtility(makeToken("brand-blue", { "background-color": "#2563eb" }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isTailwindUtility tests
// ---------------------------------------------------------------------------
describe("isTailwindUtility", () => {
  it("returns true for known Tailwind utility class names", () => {
    expect(isTailwindUtility("p-4")).toBe(true);
    expect(isTailwindUtility("mt-2")).toBe(true);
    expect(isTailwindUtility("bg-red-500")).toBe(true);
    expect(isTailwindUtility("flex")).toBe(true);       // bare "flex" ends at $
    expect(isTailwindUtility("hidden")).toBe(true);
    expect(isTailwindUtility("block")).toBe(true);
    expect(isTailwindUtility("absolute")).toBe(true);
    expect(isTailwindUtility("relative")).toBe(true);
    expect(isTailwindUtility("truncate")).toBe(true);
    expect(isTailwindUtility("italic")).toBe(true);
  });

  it("returns true for compound Tailwind utilities with prefix-dash pattern", () => {
    // These match because "flex" prefix + "-" separator
    expect(isTailwindUtility("flex-col")).toBe(true);
    // "my" is margin-y: "my-" + anything matches
    expect(isTailwindUtility("my-4")).toBe(true);
    // "inline-flex" is an exact match in the alternation
    expect(isTailwindUtility("inline-flex")).toBe(true);
  });

  it("returns false for non-Tailwind semantic class names", () => {
    expect(isTailwindUtility("nav-link")).toBe(false);
    expect(isTailwindUtility("sidebar")).toBe(false);
    expect(isTailwindUtility("hero-section")).toBe(false);
    expect(isTailwindUtility("card-body")).toBe(false);
    expect(isTailwindUtility("page-wrapper")).toBe(false);
  });

  it("handles negative value utilities with leading dash", () => {
    // The regex starts with ^-? to allow negative utilities like -mt-2
    expect(isTailwindUtility("-mt-2")).toBe(true);
    expect(isTailwindUtility("-translate-x-4")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getAlternativeTokens tests
// ---------------------------------------------------------------------------
describe("getAlternativeTokens", () => {
  // 7. getAlternativeTokens excludes raw utilities
  it("excludes raw utilities", () => {
    const alternatives = getAlternativeTokens("padding");
    const classNames = alternatives.map((t) => t.className);
    // Should NOT include p-1, p-2, p-4 (raw utilities in @layer utilities)
    expect(classNames).not.toContain("p-1");
    expect(classNames).not.toContain("p-2");
    expect(classNames).not.toContain("p-4");
    // Should include semantic tokens
    expect(classNames).toContain("spacing-sm");
    expect(classNames).toContain("spacing-md");
    expect(classNames).toContain("spacing-lg");
  });

  // 8. getAlternativeTokens only returns tokens with the exact same property
  it("only returns tokens with the exact same property", () => {
    const alternatives = getAlternativeTokens("padding");
    // gap-sm has "gap" not "padding" — should be excluded
    const classNames = alternatives.map((t) => t.className);
    expect(classNames).not.toContain("gap-sm");
  });

  it("excludes the current token from results", () => {
    const current = makeToken("spacing-md", { padding: "1rem" }, "components");
    const alternatives = getAlternativeTokens("padding", current);
    const classNames = alternatives.map((t) => t.className);
    expect(classNames).not.toContain("spacing-md");
    expect(classNames).toContain("spacing-sm");
    expect(classNames).toContain("spacing-lg");
  });

  it("returns empty array for unknown properties", () => {
    const alternatives = getAlternativeTokens("unknownProperty");
    expect(alternatives).toEqual([]);
  });

  it("accepts camelCase property names and converts to kebab-case", () => {
    // "paddingLeft" is converted to "padding-left" internally.
    // Our mock tokens only have "padding" (not "padding-left"), so no matches.
    const alternatives = getAlternativeTokens("paddingLeft");
    expect(alternatives).toEqual([]);
  });
});

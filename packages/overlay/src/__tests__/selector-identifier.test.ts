import { describe, it, expect } from "vitest";
import {
  isKnownUtilityPattern,
  isHashedClass,
  getPropertyFamily,
  countAuthoredProperties,
  scoreNamePattern,
} from "../selector/identifier";

describe("scoreNamePattern (multi-signal name scoring)", () => {
  it("gives high score to definitive utility signals", () => {
    // Variant prefixes — always utility
    expect(scoreNamePattern("hover:bg-blue-500").score).toBeGreaterThanOrEqual(0.95);
    expect(scoreNamePattern("md:flex").score).toBeGreaterThanOrEqual(0.95);
    expect(scoreNamePattern("dark:text-white").score).toBeGreaterThanOrEqual(0.95);
    expect(scoreNamePattern("focus-visible:ring-2").score).toBeGreaterThanOrEqual(0.95);
    expect(scoreNamePattern("rtl:mr-4").score).toBeGreaterThanOrEqual(0.95);
    expect(scoreNamePattern("print:hidden").score).toBeGreaterThanOrEqual(0.95);
    expect(scoreNamePattern("motion-reduce:animate-none").score).toBeGreaterThanOrEqual(0.95);

    // Arbitrary values — always utility
    expect(scoreNamePattern("w-[200px]").score).toBeGreaterThanOrEqual(0.95);
    expect(scoreNamePattern("bg-[#1a1a1a]").score).toBeGreaterThanOrEqual(0.95);
    expect(scoreNamePattern("grid-cols-[1fr_2fr]").score).toBeGreaterThanOrEqual(0.95);

    // Slash opacity — always utility
    expect(scoreNamePattern("bg-black/50").score).toBeGreaterThanOrEqual(0.95);
    expect(scoreNamePattern("text-white/80").score).toBeGreaterThanOrEqual(0.95);
  });

  it("gives high score to standard utility patterns", () => {
    // Spacing with value suffix
    expect(scoreNamePattern("p-4").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("mt-8").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("gap-3").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("m-auto").score).toBeGreaterThanOrEqual(0.65);

    // Sizing
    expect(scoreNamePattern("w-full").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("h-screen").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("min-w-0").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("max-h-96").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("size-4").score).toBeGreaterThanOrEqual(0.65);

    // Colors
    expect(scoreNamePattern("text-red-500").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("bg-blue-500").score).toBeGreaterThanOrEqual(0.65);

    // Typography
    expect(scoreNamePattern("text-sm").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("font-bold").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("leading-tight").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("tracking-wide").score).toBeGreaterThanOrEqual(0.65);

    // Layout
    expect(scoreNamePattern("rounded-lg").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("shadow-md").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("opacity-50").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("overflow-hidden").score).toBeGreaterThanOrEqual(0.65);

    // Bare stems
    expect(scoreNamePattern("flex").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("grid").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("hidden").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("block").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("relative").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("absolute").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("sticky").score).toBeGreaterThanOrEqual(0.65);

    // Tailwind v4
    expect(scoreNamePattern("grow").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("shrink-0").score).toBeGreaterThanOrEqual(0.65);
    expect(scoreNamePattern("basis-0").score).toBeGreaterThanOrEqual(0.65);
  });

  it("gives low score to semantic class names", () => {
    expect(scoreNamePattern("card").score).toBeLessThanOrEqual(0.35);
    expect(scoreNamePattern("sidebar").score).toBeLessThanOrEqual(0.35);
    expect(scoreNamePattern("hero-section").score).toBeLessThanOrEqual(0.35);
    expect(scoreNamePattern("nav-item").score).toBeLessThanOrEqual(0.35);
    expect(scoreNamePattern("btn-primary").score).toBeLessThanOrEqual(0.35);

    // BEM patterns — strongly semantic
    expect(scoreNamePattern("card__header").score).toBeLessThanOrEqual(0.15);
    expect(scoreNamePattern("btn--disabled").score).toBeLessThanOrEqual(0.15);
    expect(scoreNamePattern("card__header--highlighted").score).toBeLessThanOrEqual(0.15);
  });

  it("handles ambiguous cases with moderate scores", () => {
    // Utility stem + non-value suffix (could be semantic component like "text-hero")
    const textHero = scoreNamePattern("text-hero");
    expect(textHero.score).toBeGreaterThan(0.35);
    expect(textHero.score).toBeLessThan(0.65);
    expect(textHero.confidence).toBeLessThan(0.60); // low confidence

    // State classes — lean semantic but uncertain
    expect(scoreNamePattern("active").score).toBeLessThanOrEqual(0.35);
    expect(scoreNamePattern("disabled").score).toBeLessThanOrEqual(0.35);
    expect(scoreNamePattern("selected").score).toBeLessThanOrEqual(0.35);
  });

  it("does not false-positive on semantic names with utility prefixes", () => {
    // These start with utility stems but are component names
    const flexContainer = scoreNamePattern("flex-container");
    // Should be ambiguous, not confidently utility
    expect(flexContainer.confidence).toBeLessThan(0.60);
  });
});

describe("isKnownUtilityPattern (backward-compatible threshold)", () => {
  it("detects Tailwind spacing utilities", () => {
    expect(isKnownUtilityPattern("p-4")).toBe(true);
    expect(isKnownUtilityPattern("m-auto")).toBe(true);
    expect(isKnownUtilityPattern("gap-3")).toBe(true);
  });

  it("detects Tailwind sizing utilities", () => {
    expect(isKnownUtilityPattern("w-full")).toBe(true);
    expect(isKnownUtilityPattern("h-screen")).toBe(true);
    expect(isKnownUtilityPattern("min-w-0")).toBe(true);
    expect(isKnownUtilityPattern("max-h-96")).toBe(true);
  });

  it("detects Tailwind color/typography utilities", () => {
    expect(isKnownUtilityPattern("text-sm")).toBe(true);
    expect(isKnownUtilityPattern("text-red-500")).toBe(true);
    expect(isKnownUtilityPattern("bg-blue-500")).toBe(true);
    expect(isKnownUtilityPattern("font-bold")).toBe(true);
    expect(isKnownUtilityPattern("leading-tight")).toBe(true);
    expect(isKnownUtilityPattern("tracking-wide")).toBe(true);
  });

  it("detects Tailwind layout utilities", () => {
    expect(isKnownUtilityPattern("flex")).toBe(true);
    expect(isKnownUtilityPattern("grid")).toBe(true);
    expect(isKnownUtilityPattern("rounded-lg")).toBe(true);
    expect(isKnownUtilityPattern("shadow-md")).toBe(true);
    expect(isKnownUtilityPattern("opacity-50")).toBe(true);
    expect(isKnownUtilityPattern("overflow-hidden")).toBe(true);
  });

  it("detects Tailwind variant prefixes", () => {
    expect(isKnownUtilityPattern("hover:bg-blue-500")).toBe(true);
    expect(isKnownUtilityPattern("md:flex")).toBe(true);
    expect(isKnownUtilityPattern("dark:text-white")).toBe(true);
    expect(isKnownUtilityPattern("sm:grid")).toBe(true);
    expect(isKnownUtilityPattern("focus:ring-2")).toBe(true);
  });

  it("detects extended variant prefixes (v4, accessibility, etc.)", () => {
    expect(isKnownUtilityPattern("rtl:mr-4")).toBe(true);
    expect(isKnownUtilityPattern("print:hidden")).toBe(true);
    expect(isKnownUtilityPattern("motion-reduce:animate-none")).toBe(true);
    expect(isKnownUtilityPattern("focus-visible:ring-2")).toBe(true);
    expect(isKnownUtilityPattern("first:pt-0")).toBe(true);
    expect(isKnownUtilityPattern("last:pb-0")).toBe(true);
    expect(isKnownUtilityPattern("odd:bg-gray-100")).toBe(true);
    expect(isKnownUtilityPattern("placeholder:text-gray-400")).toBe(true);
    expect(isKnownUtilityPattern("group-hover:opacity-100")).toBe(true);
    expect(isKnownUtilityPattern("peer-checked:bg-green-500")).toBe(true);
  });

  it("detects single-word Tailwind utilities", () => {
    expect(isKnownUtilityPattern("hidden")).toBe(true);
    expect(isKnownUtilityPattern("block")).toBe(true);
    expect(isKnownUtilityPattern("relative")).toBe(true);
    expect(isKnownUtilityPattern("absolute")).toBe(true);
    expect(isKnownUtilityPattern("fixed")).toBe(true);
    expect(isKnownUtilityPattern("sticky")).toBe(true);
    expect(isKnownUtilityPattern("isolate")).toBe(true);
    expect(isKnownUtilityPattern("invisible")).toBe(true);
    expect(isKnownUtilityPattern("truncate")).toBe(true);
  });

  it("detects Tailwind v4 utilities", () => {
    expect(isKnownUtilityPattern("grow")).toBe(true);
    expect(isKnownUtilityPattern("shrink-0")).toBe(true);
    expect(isKnownUtilityPattern("basis-auto")).toBe(true);
    expect(isKnownUtilityPattern("size-4")).toBe(true);
  });

  it("detects arbitrary values", () => {
    expect(isKnownUtilityPattern("w-[200px]")).toBe(true);
    expect(isKnownUtilityPattern("bg-[#1a1a1a]")).toBe(true);
    expect(isKnownUtilityPattern("grid-cols-[1fr_2fr]")).toBe(true);
  });

  it("detects slash values", () => {
    expect(isKnownUtilityPattern("bg-black/50")).toBe(true);
    expect(isKnownUtilityPattern("text-white/80")).toBe(true);
  });

  it("does not flag semantic class names", () => {
    expect(isKnownUtilityPattern("card")).toBe(false);
    expect(isKnownUtilityPattern("sidebar")).toBe(false);
    expect(isKnownUtilityPattern("hero-section")).toBe(false);
    expect(isKnownUtilityPattern("nav-item")).toBe(false);
    expect(isKnownUtilityPattern("btn-primary")).toBe(false);
    expect(isKnownUtilityPattern("toc-link")).toBe(false);
    expect(isKnownUtilityPattern("active")).toBe(false);
    expect(isKnownUtilityPattern("selected")).toBe(false);
    expect(isKnownUtilityPattern("disabled")).toBe(false);
  });
});

describe("isHashedClass", () => {
  it("detects underscore-prefixed classes", () => {
    expect(isHashedClass("_button_abc12")).toBe(true);
    expect(isHashedClass("_styles")).toBe(true);
  });

  it("detects css- prefixed classes (CSS-in-JS)", () => {
    expect(isHashedClass("css-1a2b3c")).toBe(true);
    expect(isHashedClass("css-module")).toBe(true);
  });

  it("detects long hash patterns", () => {
    expect(isHashedClass("sc8ABcd12EFg")).toBe(true);
    expect(isHashedClass("eMj4K8pL9qR2")).toBe(true);
  });

  it("does not flag semantic classes", () => {
    expect(isHashedClass("card")).toBe(false);
    expect(isHashedClass("btn-primary")).toBe(false);
    expect(isHashedClass("toc-link")).toBe(false);
    expect(isHashedClass("active")).toBe(false);
    expect(isHashedClass("hero-section")).toBe(false);
  });

  it("does not flag short classes", () => {
    expect(isHashedClass("btn")).toBe(false);
    expect(isHashedClass("nav")).toBe(false);
  });

  it("does not flag BEM classes (double underscore)", () => {
    expect(isHashedClass("card__header")).toBe(false);
    expect(isHashedClass("card__body")).toBe(false);
    expect(isHashedClass("btn__icon")).toBe(false);
    expect(isHashedClass("nav__item")).toBe(false);
    expect(isHashedClass("menu__dropdown")).toBe(false);
    expect(isHashedClass("form__input")).toBe(false);
  });

  it("does not flag BEM modifier classes (double hyphen)", () => {
    expect(isHashedClass("card--featured")).toBe(false);
    expect(isHashedClass("btn--disabled")).toBe(false);
    expect(isHashedClass("card__header--highlighted")).toBe(false);
  });
});

describe("getPropertyFamily (shorthand collapsing)", () => {
  it("collapses padding longhands", () => {
    expect(getPropertyFamily("padding-top")).toBe("padding");
    expect(getPropertyFamily("padding-right")).toBe("padding");
    expect(getPropertyFamily("padding-bottom")).toBe("padding");
    expect(getPropertyFamily("padding-left")).toBe("padding");
  });

  it("collapses margin longhands", () => {
    expect(getPropertyFamily("margin-top")).toBe("margin");
    expect(getPropertyFamily("margin-inline-start")).toBe("margin");
  });

  it("collapses border-radius longhands", () => {
    expect(getPropertyFamily("border-top-left-radius")).toBe("border-radius");
    expect(getPropertyFamily("border-bottom-right-radius")).toBe("border-radius");
  });

  it("collapses border longhands", () => {
    expect(getPropertyFamily("border-top-width")).toBe("border");
    expect(getPropertyFamily("border-left-color")).toBe("border");
    expect(getPropertyFamily("border-bottom-style")).toBe("border");
  });

  it("collapses background longhands", () => {
    expect(getPropertyFamily("background-color")).toBe("background");
    expect(getPropertyFamily("background-image")).toBe("background");
    expect(getPropertyFamily("background-position")).toBe("background");
  });

  it("collapses overflow longhands", () => {
    expect(getPropertyFamily("overflow-x")).toBe("overflow");
    expect(getPropertyFamily("overflow-y")).toBe("overflow");
  });

  it("collapses gap longhands", () => {
    expect(getPropertyFamily("row-gap")).toBe("gap");
    expect(getPropertyFamily("column-gap")).toBe("gap");
  });

  it("collapses transition longhands", () => {
    expect(getPropertyFamily("transition-property")).toBe("transition");
    expect(getPropertyFamily("transition-duration")).toBe("transition");
  });

  it("collapses flex shorthand longhands", () => {
    expect(getPropertyFamily("flex-grow")).toBe("flex");
    expect(getPropertyFamily("flex-shrink")).toBe("flex");
    expect(getPropertyFamily("flex-basis")).toBe("flex");
  });

  it("collapses columns shorthand longhands", () => {
    expect(getPropertyFamily("column-count")).toBe("columns");
    expect(getPropertyFamily("column-width")).toBe("columns");
  });

  it("keeps independent properties separate", () => {
    expect(getPropertyFamily("display")).toBe("display");
    expect(getPropertyFamily("color")).toBe("color");
    expect(getPropertyFamily("font-size")).toBe("font-size");
    expect(getPropertyFamily("font-weight")).toBe("font-weight");
    expect(getPropertyFamily("z-index")).toBe("z-index");
    expect(getPropertyFamily("flex-direction")).toBe("flex-direction");
    expect(getPropertyFamily("opacity")).toBe("opacity");
  });
});

describe("countAuthoredProperties", () => {
  it("counts shorthand-collapsed properties", () => {
    const mockStyle = createMockStyle([
      "padding-top", "padding-right", "padding-bottom", "padding-left",
    ]);
    expect(countAuthoredProperties(mockStyle)).toBe(1);
  });

  it("counts mixed shorthand and individual properties", () => {
    const mockStyle = createMockStyle([
      "padding-top", "padding-right", "padding-bottom", "padding-left",
      "border-top-left-radius", "border-top-right-radius",
      "border-bottom-left-radius", "border-bottom-right-radius",
      "background-color", "background-image",
      "color",
      "font-size",
    ]);
    expect(countAuthoredProperties(mockStyle)).toBe(5);
  });

  it("counts single non-shorthand property as 1", () => {
    const mockStyle = createMockStyle(["display"]);
    expect(countAuthoredProperties(mockStyle)).toBe(1);
  });

  it("returns 0 for empty style", () => {
    const mockStyle = createMockStyle([]);
    expect(countAuthoredProperties(mockStyle)).toBe(0);
  });

  it("skips CSS custom properties (--*)", () => {
    const mockStyle = createMockStyle([
      "--tw-shadow", "--tw-ring-color",
      "box-shadow",
    ]);
    expect(countAuthoredProperties(mockStyle)).toBe(1);
  });

  it("skips all custom properties in a utility rule", () => {
    const mockStyle = createMockStyle([
      "--tw-shadow", "--tw-shadow-colored", "box-shadow",
    ]);
    expect(countAuthoredProperties(mockStyle)).toBe(1);
  });
});

/** Helper to create a mock CSSStyleDeclaration for testing */
function createMockStyle(properties: string[]): CSSStyleDeclaration {
  const style = {
    length: properties.length,
    [Symbol.iterator]: function* () { yield* properties; },
  } as unknown as CSSStyleDeclaration;

  for (let i = 0; i < properties.length; i++) {
    (style as any)[i] = properties[i];
  }

  return style;
}

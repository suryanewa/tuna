import { describe, it, expect } from "vitest";
import {
  pageStylesToTailwind,
} from "../page-tailwind-converter";
import {
  readPaddingValues,
} from "../tailwind-adapters";
import { defaultPageStyles, type PageStyles } from "@/lib/playground/store";
import type { TailwindStyles } from "@/lib/playground/editor-types";

/**
 * Bug: Page padding shows "0" in the UI but renders as 24px on the canvas.
 *
 * Root cause: defaultPageStyles has all padding fields as `null`. The converter
 * skips null padding → no padding classes in TailwindStyles. readPaddingValues()
 * falls back to 0 (UI shows "0"). But EditorCanvas applies a `?? "1.5rem"`
 * fallback on the rendered page wrapper, producing 24px phantom padding.
 *
 * Fix: The converter should emit explicit padding-0 classes when page padding
 * is null/undefined, so the canvas never needs a hardcoded fallback.
 */

function makePageStyles(overrides: Partial<PageStyles> = {}): PageStyles {
  return { ...defaultPageStyles, ...overrides };
}

describe("page padding: UI and render must agree", () => {
  it("default page styles should produce TailwindStyles with explicit zero padding", () => {
    const tw = pageStylesToTailwind(makePageStyles()) as TailwindStyles;

    // readPaddingValues should return 0 for all sides
    const padValues = readPaddingValues(tw);
    expect(padValues.paddingTop).toBe(0);
    expect(padValues.paddingRight).toBe(0);
    expect(padValues.paddingBottom).toBe(0);
    expect(padValues.paddingLeft).toBe(0);

    // The TailwindStyles must have at least one padding field set
    // so extractArbitraryStyles produces inline padding and the
    // canvas doesn't fall back to 1.5rem
    const hasPadding = tw.paddingTop !== undefined
      || tw.paddingRight !== undefined
      || tw.paddingBottom !== undefined
      || tw.paddingLeft !== undefined
      || tw.paddingX !== undefined
      || tw.paddingY !== undefined
      || tw.padding !== undefined;
    expect(hasPadding).toBe(true);
  });

  it("page with contentPaddingTop=0 should produce explicit padding class", () => {
    const tw = pageStylesToTailwind(makePageStyles({ contentPaddingTop: 0 })) as TailwindStyles;
    expect(tw.paddingTop).toBeDefined();
    const padValues = readPaddingValues(tw);
    expect(padValues.paddingTop).toBe(0);
  });

  it("null padding and 0 padding should produce the same readPaddingValues", () => {
    const twNull = pageStylesToTailwind(makePageStyles()) as TailwindStyles;
    const twZero = pageStylesToTailwind(makePageStyles({
      contentPaddingTop: 0,
      contentPaddingRight: 0,
      contentPaddingBottom: 0,
      contentPaddingLeft: 0,
    })) as TailwindStyles;

    const padNull = readPaddingValues(twNull);
    const padZero = readPaddingValues(twZero);

    expect(padNull.paddingTop).toBe(padZero.paddingTop);
    expect(padNull.paddingRight).toBe(padZero.paddingRight);
    expect(padNull.paddingBottom).toBe(padZero.paddingBottom);
    expect(padNull.paddingLeft).toBe(padZero.paddingLeft);
  });
});

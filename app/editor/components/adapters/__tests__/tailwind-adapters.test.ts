import { describe, it, expect } from "vitest";
import {
  // Layout
  readDirection,
  writeDirection,
  readAlignment,
  writeAlignment,
  readSpaceBetween,
  writeSpaceBetween,
  readGap,
  writeGap,
  readClipContent,
  writeClipContent,
  readPaddingMode,
  readPaddingValues,
  writePadding,
  readMarginMode,
  readMarginValues,
  writeMargin,

  // Size
  readSize,
  writeWidth,
  writeHeight,
  writeMinWidth,
  writeMinHeight,
  writeMaxWidth,
  writeMaxHeight,

  // Position
  readPositionType,
  writePositionType,
  readConstraint,
  writeConstraint,
  readPins,
  readRotation,
  writeRotation,
  readFlipHorizontal,
  writeFlipHorizontal,
  readFlipVertical,
  writeFlipVertical,
  readStickyEdge,
  readStickyValue,

  // Typography
  readFontFamily,
  writeFontFamily,
  readFontWeight,
  writeFontWeight,
  getFontWeightOptions,
  readFontSize,
  writeFontSize,
  readLineHeight,
  writeLineHeight,
  readLetterSpacing,
  writeLetterSpacing,
  readTextAlign,
  writeTextAlign,
  readVerticalAlign,
  writeVerticalAlign,
  readTextDecoration,
  writeTextDecoration,
  readTextTransform,
  writeTextTransform,
  readTextWrap,
  writeTextWrap,
  readListStyleType,
  writeListStyleType,
  readLineClamp,
  writeLineClamp,

  // Appearance
  readOpacity,
  writeOpacity,
  readBlendMode,
  writeBlendMode,
  readZIndex,
  writeZIndex,
  readCornerRadius,
  writeCornerRadius,
  readIndividualCornerRadius,
  writeIndividualCornerRadius,
  readOverflow,
  writeOverflow,
  readOverflowAxis,
  writeOverflowAxis,

  // Fill
  readFills,
  writeFills,
  readTextFills,
  writeTextFills,

  // Border
  readBorder,
  writeBorder,

  // Shadow
  readShadow,
  writeShadow,
  SHADOW_PRESETS,
  INSET_SHADOW_PRESETS,

  // Filter
  readFilters,
  writeFilters,

} from "../tailwind-adapters";
import type { TailwindStyles } from "@/lib/playground/editor-types";
import type { FillItem, ShadowValue } from "../../sections-v2";

// The extraction regex used in EditorCanvas.tsx
const ARBITRARY_REGEX = /^(.+?)-\[(.+)\](?:\/(\d+))?$/;

// ============================================================================
// Helper: check that an arbitrary class can be parsed by the canvas regex
// ============================================================================
function expectArbitrary(cls: string | undefined, expectedPrefix?: string): void {
  expect(cls).toBeDefined();
  const match = cls!.match(ARBITRARY_REGEX);
  expect(match, `"${cls}" is NOT an arbitrary value`).not.toBeNull();
  if (expectedPrefix) {
    expect(match![1]).toBe(expectedPrefix);
  }
}

// ============================================================================
// SIZE ADAPTERS
// ============================================================================

describe("Size Adapters", () => {
  describe("writeWidth / readSize", () => {
    it("should write 'fill' as w-full and read it back", () => {
      const written = writeWidth("fill");
      expect(written.width).toBe("w-full");
      const read = readSize({ width: "w-full" } as TailwindStyles);
      expect(read.width).toBe("fill");
    });

    it("should write 'auto' as w-auto and read it back", () => {
      const written = writeWidth("auto");
      expect(written.width).toBe("w-auto");
      const read = readSize({ width: "w-auto" } as TailwindStyles);
      expect(read.width).toBe("auto");
    });

    it("should write 'hug' as w-fit and read it back", () => {
      const written = writeWidth("hug");
      expect(written.width).toBe("w-fit");
      const read = readSize({ width: "w-fit" } as TailwindStyles);
      expect(read.width).toBe("hug");
    });

    it("should round-trip named spacing values (e.g. 16 = w-[16px])", () => {
      const written = writeWidth("16");
      expect(written.width).toBe("w-[16px]");
      // readSize still handles legacy named classes for backward compat
      const read = readSize({ width: "w-4" } as TailwindStyles);
      expect(read.width).toBe("16");
      // And also reads arbitrary values
      const read2 = readSize({ width: "w-[16px]" } as TailwindStyles);
      expect(read2.width).toBe("16");
    });

    it("should round-trip arbitrary pixel values", () => {
      const written = writeWidth("200");
      expect(written.width).toBe("w-[200px]");
      expectArbitrary(written.width, "w");
      const read = readSize({ width: "w-[200px]" } as TailwindStyles);
      expect(read.width).toBe("200");
    });

    it("should handle 0 value", () => {
      const written = writeWidth("0");
      expect(written.width).toBe("w-0");
      const read = readSize({ width: "w-0" } as TailwindStyles);
      expect(read.width).toBe("0");
    });

    it("should default to 'auto' when no width is set", () => {
      const read = readSize({} as TailwindStyles);
      expect(read.width).toBe("auto");
    });

    it("should return undefined for undefined input", () => {
      const written = writeWidth(undefined);
      expect(written.width).toBeUndefined();
    });
  });

  describe("writeHeight / readSize", () => {
    it("should write 'fill' as h-full and read it back", () => {
      const written = writeHeight("fill");
      expect(written.height).toBe("h-full");
      const read = readSize({ height: "h-full" } as TailwindStyles);
      expect(read.height).toBe("fill");
    });

    it("should round-trip named spacing values", () => {
      const written = writeHeight("32");
      expect(written.height).toBe("h-[32px]");
      // readSize still handles legacy named classes for backward compat
      const read = readSize({ height: "h-8" } as TailwindStyles);
      expect(read.height).toBe("32");
      // And also reads arbitrary values
      const read2 = readSize({ height: "h-[32px]" } as TailwindStyles);
      expect(read2.height).toBe("32");
    });

    it("should round-trip arbitrary pixel values", () => {
      const written = writeHeight("300");
      expect(written.height).toBe("h-[300px]");
      expectArbitrary(written.height, "h");
      const read = readSize({ height: "h-[300px]" } as TailwindStyles);
      expect(read.height).toBe("300");
    });
  });

  describe("writeMinWidth / readSize", () => {
    it("should write and read min-width", () => {
      const written = writeMinWidth("100");
      expect(written.minWidth).toBe("min-w-[100px]");
      expectArbitrary(written.minWidth, "min-w");
      const read = readSize({ minWidth: "min-w-[100px]" } as TailwindStyles);
      expect(read.minWidth).toBe("100");
    });

    it("should clear when value is undefined", () => {
      const written = writeMinWidth(undefined);
      expect(written.minWidth).toBeUndefined();
    });
  });

  describe("writeMinHeight / readSize", () => {
    it("should write and read min-height", () => {
      const written = writeMinHeight("50");
      expect(written.minHeight).toBe("min-h-[50px]");
      expectArbitrary(written.minHeight, "min-h");
      const read = readSize({ minHeight: "min-h-[50px]" } as TailwindStyles);
      expect(read.minHeight).toBe("50");
    });
  });

  describe("writeMaxWidth / readSize", () => {
    it("should write and read max-width", () => {
      const written = writeMaxWidth("400");
      expect(written.maxWidth).toBe("max-w-[400px]");
      expectArbitrary(written.maxWidth, "max-w");
      const read = readSize({ maxWidth: "max-w-[400px]" } as TailwindStyles);
      expect(read.maxWidth).toBe("400");
    });
  });

  describe("writeMaxHeight / readSize", () => {
    it("should write and read max-height", () => {
      const written = writeMaxHeight("600");
      expect(written.maxHeight).toBe("max-h-[600px]");
      expectArbitrary(written.maxHeight, "max-h");
      const read = readSize({ maxHeight: "max-h-[600px]" } as TailwindStyles);
      expect(read.maxHeight).toBe("600");
    });
  });

  describe("viewport sizing", () => {
    it("writeHeight('viewport') → h-dvh → reads back 'viewport'", () => {
      const written = writeHeight("viewport");
      expect(written.height).toBe("h-dvh");
      const read = readSize({ height: "h-dvh" } as TailwindStyles);
      expect(read.height).toBe("viewport");
    });

    it("writeWidth('viewport') → w-dvw → reads back 'viewport'", () => {
      const written = writeWidth("viewport");
      expect(written.width).toBe("w-dvw");
      const read = readSize({ width: "w-dvw" } as TailwindStyles);
      expect(read.width).toBe("viewport");
    });

    it("writeMinHeight('viewport') → min-h-dvh → reads back 'viewport'", () => {
      const written = writeMinHeight("viewport");
      expect(written.minHeight).toBe("min-h-dvh");
      const read = readSize({ minHeight: "min-h-dvh" } as TailwindStyles);
      expect(read.minHeight).toBe("viewport");
    });

    it("writeMinWidth('viewport') → min-w-dvw → reads back 'viewport'", () => {
      const written = writeMinWidth("viewport");
      expect(written.minWidth).toBe("min-w-dvw");
      const read = readSize({ minWidth: "min-w-dvw" } as TailwindStyles);
      expect(read.minWidth).toBe("viewport");
    });

    it("writeMaxHeight('viewport') → max-h-dvh → reads back 'viewport'", () => {
      const written = writeMaxHeight("viewport");
      expect(written.maxHeight).toBe("max-h-dvh");
      const read = readSize({ maxHeight: "max-h-dvh" } as TailwindStyles);
      expect(read.maxHeight).toBe("viewport");
    });

    it("writeMaxWidth('viewport') → max-w-dvw → reads back 'viewport'", () => {
      const written = writeMaxWidth("viewport");
      expect(written.maxWidth).toBe("max-w-dvw");
      const read = readSize({ maxWidth: "max-w-dvw" } as TailwindStyles);
      expect(read.maxWidth).toBe("viewport");
    });

    it("legacy h-screen reads as 'viewport'", () => {
      const read = readSize({ height: "h-screen" } as TailwindStyles);
      expect(read.height).toBe("viewport");
    });

    it("legacy w-screen reads as 'viewport'", () => {
      const read = readSize({ width: "w-screen" } as TailwindStyles);
      expect(read.width).toBe("viewport");
    });

    it("viewport → pixel → viewport roundtrips cleanly", () => {
      // Set viewport
      const v = writeHeight("viewport");
      expect(v.height).toBe("h-dvh");
      // Switch to pixel
      const px = writeHeight("500");
      expect(px.height).toBe("h-[500px]");
      const readPx = readSize({ height: "h-[500px]" } as TailwindStyles);
      expect(readPx.height).toBe("500");
      // Switch back to viewport
      const v2 = writeHeight("viewport");
      expect(v2.height).toBe("h-dvh");
      const readV2 = readSize({ height: "h-dvh" } as TailwindStyles);
      expect(readV2.height).toBe("viewport");
    });
  });
});

// ============================================================================
// SPACING ADAPTERS (gap, padding, margin)
// ============================================================================

describe("Spacing Adapters", () => {
  describe("writeGap / readGap", () => {
    it("should round-trip named spacing gap values", () => {
      // gap-4 = 16px
      const written = writeGap(16);
      expect(written.gap).toBe("gap-4");
      const read = readGap({ gap: "gap-4" } as TailwindStyles);
      expect(read).toBe(16);
    });

    it("should round-trip arbitrary gap values", () => {
      const written = writeGap(15);
      expect(written.gap).toBe("gap-[15px]");
      expectArbitrary(written.gap, "gap");
    });

    it("should handle 0 gap", () => {
      const written = writeGap(0);
      expect(written.gap).toBe("gap-0");
      const read = readGap({ gap: "gap-0" } as TailwindStyles);
      expect(read).toBe(0);
    });

    it("should default to 0 when no gap", () => {
      const read = readGap({} as TailwindStyles);
      expect(read).toBe(0);
    });

    it("should handle undefined input", () => {
      const written = writeGap(undefined);
      expect(written.gap).toBeUndefined();
    });
  });

  describe("writePadding / readPaddingValues / readPaddingMode", () => {
    it("should write xy-mode paddingX", () => {
      const written = writePadding("x", 16, "xy");
      expect(written.paddingX).toBe("px-4");
    });

    it("should write xy-mode paddingY", () => {
      const written = writePadding("y", 24, "xy");
      expect(written.paddingY).toBe("py-6");
    });

    it("should read xy-mode padding values", () => {
      const styles = { paddingX: "px-4", paddingY: "py-6" } as TailwindStyles;
      const values = readPaddingValues(styles);
      expect(values.paddingX).toBe(16);
      expect(values.paddingY).toBe(24);
    });

    it("should write individual padding sides", () => {
      const top = writePadding("top", 8, "individual");
      expect(top.paddingTop).toBe("pt-2");
      const right = writePadding("right", 12, "individual");
      expect(right.paddingRight).toBe("pr-3");
      const bottom = writePadding("bottom", 16, "individual");
      expect(bottom.paddingBottom).toBe("pb-4");
      const left = writePadding("left", 20, "individual");
      expect(left.paddingLeft).toBe("pl-5");
    });

    it("should read individual padding values", () => {
      const styles = {
        paddingTop: "pt-2",
        paddingRight: "pr-3",
        paddingBottom: "pb-4",
        paddingLeft: "pl-5",
      } as TailwindStyles;
      const values = readPaddingValues(styles);
      expect(values.paddingTop).toBe(8);
      expect(values.paddingRight).toBe(12);
      expect(values.paddingBottom).toBe(16);
      expect(values.paddingLeft).toBe(20);
    });

    it("should detect individual padding mode", () => {
      const mode = readPaddingMode({ paddingTop: "pt-2" } as TailwindStyles);
      expect(mode).toBe("individual");
    });

    it("should detect xy padding mode", () => {
      const mode = readPaddingMode({ paddingX: "px-4" } as TailwindStyles);
      expect(mode).toBe("xy");
    });

    it("should fallback to 0 for missing padding", () => {
      const values = readPaddingValues({} as TailwindStyles);
      expect(values.paddingX).toBe(0);
      expect(values.paddingY).toBe(0);
      expect(values.paddingTop).toBe(0);
      expect(values.paddingRight).toBe(0);
      expect(values.paddingBottom).toBe(0);
      expect(values.paddingLeft).toBe(0);
    });

    it("should write arbitrary padding values", () => {
      const written = writePadding("x", 15, "xy");
      expect(written.paddingX).toBe("px-[15px]");
      expectArbitrary(written.paddingX, "px");
    });
  });

  describe("writeMargin / readMarginValues / readMarginMode", () => {
    it("should write xy-mode marginX", () => {
      const written = writeMargin("x", 16, "xy");
      expect(written.marginX).toBe("mx-4");
    });

    it("should write xy-mode marginY", () => {
      const written = writeMargin("y", 24, "xy");
      expect(written.marginY).toBe("my-6");
    });

    it("should read xy-mode margin values", () => {
      const styles = { marginX: "mx-4", marginY: "my-6" } as TailwindStyles;
      const values = readMarginValues(styles);
      expect(values.marginX).toBe(16);
      expect(values.marginY).toBe(24);
    });

    it("should write individual margin sides", () => {
      const top = writeMargin("top", 8, "individual");
      expect(top.marginTop).toBe("mt-2");
      const right = writeMargin("right", 12, "individual");
      expect(right.marginRight).toBe("mr-3");
      const bottom = writeMargin("bottom", 16, "individual");
      expect(bottom.marginBottom).toBe("mb-4");
      const left = writeMargin("left", 20, "individual");
      expect(left.marginLeft).toBe("ml-5");
    });

    it("should read individual margin values", () => {
      const styles = {
        marginTop: "mt-2",
        marginRight: "mr-3",
        marginBottom: "mb-4",
        marginLeft: "ml-5",
      } as TailwindStyles;
      const values = readMarginValues(styles);
      expect(values.marginTop).toBe(8);
      expect(values.marginRight).toBe(12);
      expect(values.marginBottom).toBe(16);
      expect(values.marginLeft).toBe(20);
    });

    it("should detect individual margin mode", () => {
      const mode = readMarginMode({ marginTop: "mt-2" } as TailwindStyles);
      expect(mode).toBe("individual");
    });

    it("should detect xy margin mode", () => {
      const mode = readMarginMode({} as TailwindStyles);
      expect(mode).toBe("xy");
    });

    it("should fallback to 0 for missing margins", () => {
      const values = readMarginValues({} as TailwindStyles);
      expect(values.marginX).toBe(0);
      expect(values.marginY).toBe(0);
      expect(values.marginTop).toBe(0);
      expect(values.marginRight).toBe(0);
      expect(values.marginBottom).toBe(0);
      expect(values.marginLeft).toBe(0);
    });

    it("should write arbitrary margin values", () => {
      const written = writeMargin("top", 13, "individual");
      expect(written.marginTop).toBe("mt-[13px]");
      expectArbitrary(written.marginTop, "mt");
    });
  });
});

// ============================================================================
// TYPOGRAPHY ADAPTERS
// ============================================================================

describe("Typography Adapters", () => {
  describe("writeFontSize / readFontSize", () => {
    it("should round-trip standard font sizes", () => {
      const sizes = [
        { px: "12", cls: "text-xs" },
        { px: "14", cls: "text-sm" },
        { px: "16", cls: "text-base" },
        { px: "18", cls: "text-lg" },
        { px: "20", cls: "text-xl" },
        { px: "24", cls: "text-2xl" },
        { px: "30", cls: "text-3xl" },
        { px: "36", cls: "text-4xl" },
        { px: "48", cls: "text-5xl" },
        { px: "60", cls: "text-6xl" },
        { px: "72", cls: "text-7xl" },
        { px: "96", cls: "text-8xl" },
        { px: "128", cls: "text-9xl" },
      ];

      for (const { px, cls } of sizes) {
        const written = writeFontSize(px);
        expect(written.fontSize).toBe(cls);
        const readBack = readFontSize({ fontSize: cls } as TailwindStyles);
        expect(readBack).toBe(px);
      }
    });

    it("should use arbitrary values for non-standard sizes", () => {
      const written = writeFontSize("22");
      expect(written.fontSize).toBe("text-[22px]");
      expectArbitrary(written.fontSize, "text");
    });

    it("should default to 16 when no fontSize set", () => {
      const read = readFontSize({} as TailwindStyles);
      expect(read).toBe("16");
    });
  });

  describe("writeLineHeight / readLineHeight", () => {
    it("should round-trip named line heights", () => {
      const cases = [
        { value: "auto", cls: "leading-normal" },
        { value: "1", cls: "leading-none" },
        { value: "1.25", cls: "leading-tight" },
        { value: "1.375", cls: "leading-snug" },
        { value: "1.625", cls: "leading-relaxed" },
        { value: "2", cls: "leading-loose" },
      ];

      for (const { value, cls } of cases) {
        const written = writeLineHeight(value);
        expect(written.lineHeight).toBe(cls);
        const readBack = readLineHeight({ lineHeight: cls } as TailwindStyles);
        expect(readBack).toBe(value);
      }
    });

    it("should round-trip numeric px line heights", () => {
      // leading-5 = 5*4 = 20px
      const written = writeLineHeight("20");
      expect(written.lineHeight).toBe("leading-5");
      const read = readLineHeight({ lineHeight: "leading-5" } as TailwindStyles);
      expect(read).toBe("20");
    });

    it("should default to auto when no lineHeight set", () => {
      const read = readLineHeight({} as TailwindStyles);
      expect(read).toBe("auto");
    });

    it("should round-trip non-multiple-of-4 line heights without loss", () => {
      // BUG: writeLineHeight("41") → leading-10 → readLineHeight → "40" (lost 1px)
      // These values should survive a write→read round-trip exactly
      const cases = ["41", "42", "43", "17", "18", "19", "21", "22", "23", "25", "26", "27"];
      for (const value of cases) {
        const written = writeLineHeight(value);
        const readBack = readLineHeight({ lineHeight: written.lineHeight } as TailwindStyles);
        expect(readBack, `Round-trip failed for ${value}: wrote ${written.lineHeight}, read back ${readBack}`).toBe(value);
      }
    });

    it("should not skip values when incrementing by 1 (arrow key behavior)", () => {
      // BUG: Incrementing from 41 → 42 → 43 → 44 should produce distinct results
      // but writeLineHeight("41") and writeLineHeight("42") both round to different
      // leading-N values that read back as 40 and 44 respectively, skipping 41-43
      const results: string[] = [];
      for (let px = 40; px <= 48; px++) {
        const written = writeLineHeight(String(px));
        const readBack = readLineHeight({ lineHeight: written.lineHeight } as TailwindStyles);
        results.push(readBack);
      }
      // Each increment should produce a distinct, sequential value
      const expected = ["40", "41", "42", "43", "44", "45", "46", "47", "48"];
      expect(results).toEqual(expected);
    });
  });

  describe("writeLetterSpacing / readLetterSpacing", () => {
    it("should output arbitrary values that extractArbitraryStyles can match", () => {
      const testCases = ["2.5%", "5%", "10%", "-2.5%", "-5%"];

      for (const pct of testCases) {
        const result = writeLetterSpacing(pct);
        const cls = result.letterSpacing;
        expect(cls, `writeLetterSpacing("${pct}") returned undefined`).toBeDefined();

        const match = cls!.match(ARBITRARY_REGEX);
        expect(
          match,
          `writeLetterSpacing("${pct}") returned "${cls}" which is NOT an arbitrary value`
        ).not.toBeNull();
      }
    });

    it("should round-trip through readLetterSpacing", () => {
      const testCases = ["0%", "2.5%", "5%", "10%", "-2.5%", "-5%"];

      for (const pct of testCases) {
        const written = writeLetterSpacing(pct);
        const readBack = readLetterSpacing(written as TailwindStyles);
        expect(readBack, `round-trip failed for "${pct}"`).toBe(pct);
      }
    });

    it("should handle 0% by clearing letterSpacing", () => {
      const written = writeLetterSpacing("0%");
      expect(written.letterSpacing).toBeUndefined();
      const readBack = readLetterSpacing({} as TailwindStyles);
      expect(readBack).toBe("0%");
    });

    it("should read named tracking classes for backwards compatibility", () => {
      expect(readLetterSpacing({ letterSpacing: "tracking-tighter" } as TailwindStyles)).toBe("-5%");
      expect(readLetterSpacing({ letterSpacing: "tracking-tight" } as TailwindStyles)).toBe("-2.5%");
      expect(readLetterSpacing({ letterSpacing: "tracking-normal" } as TailwindStyles)).toBe("0%");
      expect(readLetterSpacing({ letterSpacing: "tracking-wide" } as TailwindStyles)).toBe("2.5%");
      expect(readLetterSpacing({ letterSpacing: "tracking-wider" } as TailwindStyles)).toBe("5%");
      expect(readLetterSpacing({ letterSpacing: "tracking-widest" } as TailwindStyles)).toBe("10%");
    });
  });

  describe("writeFontWeight / readFontWeight", () => {
    it("should round-trip all font weights", () => {
      const weights = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];

      for (const w of weights) {
        const written = writeFontWeight(w);
        const readBack = readFontWeight(written as TailwindStyles);
        expect(readBack, `round-trip failed for weight ${w}`).toBe(w);
      }
    });

    it("should default to 400 when no fontWeight set", () => {
      const read = readFontWeight({} as TailwindStyles);
      expect(read).toBe("400");
    });

    it("should fallback to font-normal for invalid weight", () => {
      const written = writeFontWeight("450");
      expect(written.fontWeight).toBe("font-normal");
    });
  });

  describe("getFontWeightOptions", () => {
    it("should return all 9 font weight options", () => {
      const options = getFontWeightOptions();
      expect(options).toHaveLength(9);
      expect(options[0].value).toBe("100");
      expect(options[0].label).toBe("Thin");
      expect(options[8].value).toBe("900");
      expect(options[8].label).toBe("Black");
    });
  });

  describe("writeFontFamily / readFontFamily", () => {
    it("should round-trip font family", () => {
      const written = writeFontFamily("Roboto");
      expect(written.fontFamily).toBe("Roboto");
      const read = readFontFamily(written as TailwindStyles);
      expect(read).toBe("Roboto");
    });

    it("should default to Inter when no fontFamily set", () => {
      const read = readFontFamily({} as TailwindStyles);
      expect(read).toBe("Inter");
    });
  });

  describe("writeTextAlign / readTextAlign", () => {
    it("should round-trip all text alignments", () => {
      const aligns: Array<"left" | "center" | "right" | "justify"> = ["left", "center", "right", "justify"];
      for (const align of aligns) {
        const written = writeTextAlign(align);
        const read = readTextAlign(written as TailwindStyles);
        expect(read).toBe(align);
      }
    });

    it("should default to left when no textAlign set", () => {
      const read = readTextAlign({} as TailwindStyles);
      expect(read).toBe("left");
    });
  });

  describe("writeVerticalAlign / readVerticalAlign", () => {
    it("should round-trip all vertical alignments", () => {
      const aligns: Array<"top" | "middle" | "bottom"> = ["top", "middle", "bottom"];
      for (const align of aligns) {
        const written = writeVerticalAlign(align);
        const read = readVerticalAlign(written as TailwindStyles);
        expect(read).toBe(align);
      }
    });

    it("should default to top when no verticalAlign set", () => {
      const read = readVerticalAlign({} as TailwindStyles);
      expect(read).toBe("top");
    });

    it("should use flexbox-based approach instead of CSS vertical-align", () => {
      // CSS vertical-align (align-top/middle/bottom) has no effect on block elements
      // like <p> and <h2>. Text vertical alignment needs display:flex + justify-content.
      const middle = writeVerticalAlign("middle");
      expect(middle.verticalAlign).not.toBe("align-middle"); // align-middle doesn't work on blocks

      const bottom = writeVerticalAlign("bottom");
      expect(bottom.verticalAlign).not.toBe("align-bottom"); // align-bottom doesn't work on blocks

      // Should use flex + justify-content approach
      expect(middle.display).toBe("flex");
      expect(middle.flexDirection).toBe("flex-col");
      expect(middle.justifyContent).toBe("justify-center");

      expect(bottom.display).toBe("flex");
      expect(bottom.flexDirection).toBe("flex-col");
      expect(bottom.justifyContent).toBe("justify-end");
    });

    it("should read vertical align from justifyContent field", () => {
      expect(readVerticalAlign({ justifyContent: "justify-center" } as TailwindStyles)).toBe("middle");
      expect(readVerticalAlign({ justifyContent: "justify-end" } as TailwindStyles)).toBe("bottom");
      expect(readVerticalAlign({ justifyContent: "justify-start" } as TailwindStyles)).toBe("top");
      expect(readVerticalAlign({} as TailwindStyles)).toBe("top");
    });

    it("top alignment should clear flex vertical-align props", () => {
      // Setting top should remove the flex overrides so text renders normally
      const top = writeVerticalAlign("top");
      // Should either not set display/flexDirection/justifyContent, or set them to defaults
      // The key is it shouldn't leave justify-center or justify-end
      expect(top.justifyContent).not.toBe("justify-center");
      expect(top.justifyContent).not.toBe("justify-end");
    });
  });
});

// ============================================================================
// APPEARANCE ADAPTERS
// ============================================================================

describe("Appearance Adapters", () => {
  describe("writeOpacity / readOpacity", () => {
    it("should round-trip preset opacity values", () => {
      const presets = [0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95];
      for (const val of presets) {
        const written = writeOpacity(val);
        expect(written.opacity).toBe(`opacity-${val}`);
        const read = readOpacity(written as TailwindStyles);
        expect(read).toBe(val);
      }
    });

    it("should clear opacity at 100%", () => {
      const written = writeOpacity(100);
      expect(written.opacity).toBeUndefined();
      const read = readOpacity({} as TailwindStyles);
      expect(read).toBe(100);
    });

    it("should use arbitrary value for non-multiples-of-5", () => {
      const written = writeOpacity(37);
      expect(written.opacity).toBe("opacity-[0.37]");
      expectArbitrary(written.opacity, "opacity");
      const read = readOpacity(written as TailwindStyles);
      expect(read).toBe(37);
    });

    it("should handle 0% opacity", () => {
      const written = writeOpacity(0);
      expect(written.opacity).toBe("opacity-0");
      const read = readOpacity(written as TailwindStyles);
      expect(read).toBe(0);
    });
  });

  describe("writeBlendMode / readBlendMode", () => {
    it("should round-trip blend modes", () => {
      const modes: Array<"normal" | "multiply" | "screen" | "overlay"> = [
        "normal",
        "multiply",
        "screen",
        "overlay",
      ];
      for (const mode of modes) {
        const written = writeBlendMode(mode);
        const read = readBlendMode(written as TailwindStyles);
        expect(read).toBe(mode);
      }
    });

    it("should clear mixBlendMode for normal", () => {
      const written = writeBlendMode("normal");
      expect(written.mixBlendMode).toBeUndefined();
    });

    it("should default to normal when no mixBlendMode", () => {
      const read = readBlendMode({} as TailwindStyles);
      expect(read).toBe("normal");
    });
  });

  describe("writeZIndex / readZIndex", () => {
    it("should round-trip z-index values", () => {
      const values = ["0", "10", "20", "30", "40", "50", "auto"];
      for (const val of values) {
        const written = writeZIndex(val);
        expect(written.zIndex).toBe(`z-${val}`);
        const read = readZIndex(written as TailwindStyles);
        expect(read).toBe(val);
      }
    });

    it("should clear zIndex for undefined/empty", () => {
      expect(writeZIndex(undefined).zIndex).toBeUndefined();
      expect(writeZIndex("").zIndex).toBeUndefined();
    });

    it("should default to auto when no zIndex", () => {
      const read = readZIndex({} as TailwindStyles);
      expect(read).toBe("auto");
    });

    it("should use arbitrary syntax for non-standard z-index values", () => {
      // Tailwind only has z-0, z-10, z-20, z-30, z-40, z-50, z-auto as named classes.
      // Non-standard values like z-2, z-5, z-100 are NOT valid Tailwind classes.
      // They must use arbitrary value syntax: z-[2], z-[5], z-[100]
      expect(writeZIndex("2").zIndex).toBe("z-[2]");
      expect(writeZIndex("5").zIndex).toBe("z-[5]");
      expect(writeZIndex("100").zIndex).toBe("z-[100]");
      expect(writeZIndex("-1").zIndex).toBe("-z-[1]");

      // Named values should still use standard classes
      expect(writeZIndex("0").zIndex).toBe("z-0");
      expect(writeZIndex("10").zIndex).toBe("z-10");
      expect(writeZIndex("50").zIndex).toBe("z-50");
      expect(writeZIndex("auto").zIndex).toBe("z-auto");

      // Round-trip arbitrary values
      expect(readZIndex({ zIndex: "z-[2]" } as TailwindStyles)).toBe("2");
      expect(readZIndex({ zIndex: "z-[100]" } as TailwindStyles)).toBe("100");
      expect(readZIndex({ zIndex: "-z-[1]" } as TailwindStyles)).toBe("-1");
    });
  });

  describe("writeOverflow / readOverflow", () => {
    it("should round-trip overflow values", () => {
      const values: Array<"visible" | "hidden" | "scroll" | "auto"> = ["visible", "hidden", "scroll", "auto"];
      for (const val of values) {
        const written = writeOverflow(val);
        const read = readOverflow(written as TailwindStyles);
        expect(read).toBe(val);
      }
    });

    it("should clear overflow for visible", () => {
      const written = writeOverflow("visible");
      expect(written.overflow).toBeUndefined();
    });

    it("should default to visible when no overflow", () => {
      const read = readOverflow({} as TailwindStyles);
      expect(read).toBe("visible");
    });
  });

  describe("writeOverflowAxis / readOverflowAxis", () => {
    it("should round-trip per-axis overflow", () => {
      const writtenX = writeOverflowAxis("X", "scroll");
      expect(writtenX.overflowX).toBe("overflow-x-scroll");
      const readX = readOverflowAxis({ overflowX: "overflow-x-scroll" } as TailwindStyles, "X");
      expect(readX).toBe("scroll");

      const writtenY = writeOverflowAxis("Y", "hidden");
      expect(writtenY.overflowY).toBe("overflow-y-hidden");
      const readY = readOverflowAxis({ overflowY: "overflow-y-hidden" } as TailwindStyles, "Y");
      expect(readY).toBe("hidden");
    });

    it("should fall back to shared overflow when axis not set", () => {
      const read = readOverflowAxis({ overflow: "overflow-hidden" } as TailwindStyles, "X");
      expect(read).toBe("hidden");
    });

    it("should clear axis overflow for visible", () => {
      const writtenX = writeOverflowAxis("X", "visible");
      expect(writtenX.overflowX).toBeUndefined();
    });
  });
});

// ============================================================================
// BORDER ADAPTERS (borderWidth, borderRadius/cornerRadius)
// ============================================================================

describe("Border Adapters", () => {
  describe("writeCornerRadius / readCornerRadius", () => {
    it("should round-trip named border radius values", () => {
      const cases = [
        { px: "0", cls: "rounded-none" },
        { px: "2", cls: "rounded-sm" },
        { px: "4", cls: "rounded" },
        { px: "6", cls: "rounded-md" },
        { px: "8", cls: "rounded-lg" },
        { px: "12", cls: "rounded-xl" },
        { px: "16", cls: "rounded-2xl" },
        { px: "24", cls: "rounded-3xl" },
        { px: "9999", cls: "rounded-full" },
      ];

      for (const { px, cls } of cases) {
        const written = writeCornerRadius(px);
        expect(written.borderRadius).toBe(cls);
        const read = readCornerRadius({ borderRadius: cls } as TailwindStyles);
        expect(read).toBe(px);
      }
    });

    it("should use arbitrary value for non-standard radius", () => {
      const written = writeCornerRadius("10");
      expect(written.borderRadius).toBe("rounded-[10px]");
      expectArbitrary(written.borderRadius, "rounded");
    });

    it("should clear when value is undefined", () => {
      const written = writeCornerRadius(undefined);
      expect(written.borderRadius).toBeUndefined();
    });

    it("should default to 0 when no borderRadius", () => {
      const read = readCornerRadius({} as TailwindStyles);
      expect(read).toBe("0");
    });
  });

  describe("writeIndividualCornerRadius / readIndividualCornerRadius", () => {
    it("should round-trip individual corner radii", () => {
      const corners: Array<"TopLeft" | "TopRight" | "BottomLeft" | "BottomRight"> = [
        "TopLeft",
        "TopRight",
        "BottomLeft",
        "BottomRight",
      ];

      for (const corner of corners) {
        const written = writeIndividualCornerRadius(corner, "8");
        const prefix = corner === "TopLeft" ? "rounded-tl" : corner === "TopRight" ? "rounded-tr" : corner === "BottomLeft" ? "rounded-bl" : "rounded-br";
        expect(written[`borderRadius${corner}` as keyof typeof written]).toBe(`${prefix}-lg`);

        const read = readIndividualCornerRadius(
          { [`borderRadius${corner}`]: `${prefix}-lg` } as unknown as TailwindStyles,
          corner
        );
        expect(read).toBe("8");
      }
    });

    it("should use arbitrary value for non-standard individual radius", () => {
      const written = writeIndividualCornerRadius("TopLeft", "10");
      expect(written.borderRadiusTopLeft).toBe("rounded-tl-[10px]");
    });

    it("should clear when value is undefined", () => {
      const written = writeIndividualCornerRadius("TopLeft", undefined);
      expect(written.borderRadiusTopLeft).toBeUndefined();
    });

    it("should default to 0 when no individual corner radius", () => {
      const read = readIndividualCornerRadius({} as TailwindStyles, "TopLeft");
      expect(read).toBe("0");
    });
  });

  describe("writeBorder / readBorder", () => {
    it("should round-trip a basic all-side border", () => {
      const border = { color: "#ff0000", opacity: 100, width: 2, style: "solid" as const, side: "all" as const };
      const written = writeBorder(border);
      expect(written.borderWidth).toBe("border-2");
      expect(written.borderColor).toBe("border-[#ff0000]");
      expect(written.borderStyle).toBe("border-solid");

      const read = readBorder(written as TailwindStyles);
      expect(read).not.toBeNull();
      expect(read!.width).toBe(2);
      expect(read!.style).toBe("solid");
      expect(read!.side).toBe("all");
    });

    it("should handle border width 1 (default)", () => {
      const border = { color: "#000000", opacity: 100, width: 1, style: "solid" as const, side: "all" as const };
      const written = writeBorder(border);
      expect(written.borderWidth).toBe("border");
    });

    it("should handle border width 0", () => {
      const border = { color: "#000000", opacity: 100, width: 0, style: "solid" as const, side: "all" as const };
      const written = writeBorder(border);
      expect(written.borderWidth).toBe("border-0");
    });

    it("should handle dashed border style", () => {
      const border = { color: "#000000", opacity: 100, width: 1, style: "dashed" as const, side: "all" as const };
      const written = writeBorder(border);
      expect(written.borderStyle).toBe("border-dashed");

      const read = readBorder(written as TailwindStyles);
      expect(read!.style).toBe("dashed");
    });

    it("should handle per-side border (top only)", () => {
      const border = { color: "#000000", opacity: 100, width: 2, style: "solid" as const, side: "top" as const };
      const written = writeBorder(border);
      expect(written.borderWidth).toBeUndefined();
      expect(written.borderWidthTop).toBe("border-t-2");
    });

    it("should handle per-side border (right only)", () => {
      const border = { color: "#000000", opacity: 100, width: 4, style: "solid" as const, side: "right" as const };
      const written = writeBorder(border);
      expect(written.borderWidthRight).toBe("border-r-4");
    });

    it("should handle per-side border (bottom only)", () => {
      const border = { color: "#000000", opacity: 100, width: 1, style: "solid" as const, side: "bottom" as const };
      const written = writeBorder(border);
      expect(written.borderWidthBottom).toBe("border-b");
    });

    it("should handle per-side border (left only)", () => {
      const border = { color: "#000000", opacity: 100, width: 8, style: "solid" as const, side: "left" as const };
      const written = writeBorder(border);
      expect(written.borderWidthLeft).toBe("border-l-8");
    });

    it("should use arbitrary width for non-standard values", () => {
      const border = { color: "#000000", opacity: 100, width: 3, style: "solid" as const, side: "all" as const };
      const written = writeBorder(border);
      expect(written.borderWidth).toBe("border-[3px]");
    });

    it("should clear all border fields when null", () => {
      const written = writeBorder(null);
      expect(written.borderWidth).toBeUndefined();
      expect(written.borderColor).toBeUndefined();
      expect(written.borderStyle).toBeUndefined();
      expect(written.borderWidthTop).toBeUndefined();
      expect(written.borderWidthRight).toBeUndefined();
      expect(written.borderWidthBottom).toBeUndefined();
      expect(written.borderWidthLeft).toBeUndefined();
    });

    it("should return null when no borderWidth set", () => {
      const read = readBorder({} as TailwindStyles);
      expect(read).toBeNull();
    });

    it("should preserve border-prefixed colors", () => {
      const border = { color: "border-red-500", opacity: 100, width: 1, style: "solid" as const, side: "all" as const };
      const written = writeBorder(border);
      // Should not double-prefix
      expect(written.borderColor).toBe("border-red-500");
    });

    it("should round-trip border opacity", () => {
      const border = { color: "#ff0000", opacity: 50, width: 2, style: "solid" as const, side: "all" as const };
      const written = writeBorder(border);
      const read = readBorder(written as TailwindStyles);
      expect(read).not.toBeNull();
      expect(read!.opacity).toBe(50);
    });

    it("should encode opacity into the border color class", () => {
      const border = { color: "#ff0000", opacity: 50, width: 1, style: "solid" as const, side: "all" as const };
      const written = writeBorder(border);
      // The color class should include opacity info (e.g., border-[#ff0000]/50)
      expect(written.borderColor).toContain("50");
    });

    it("should not add opacity modifier when opacity is 100", () => {
      const border = { color: "#ff0000", opacity: 100, width: 1, style: "solid" as const, side: "all" as const };
      const written = writeBorder(border);
      // No /100 suffix needed for full opacity
      expect(written.borderColor).toBe("border-[#ff0000]");
    });
  });
});

// ============================================================================
// LAYOUT ADAPTERS
// ============================================================================

describe("Layout Adapters", () => {
  describe("writeDirection / readDirection", () => {
    it("should round-trip all flow directions", () => {
      const directions: Array<"vertical" | "horizontal" | "wrap"> = ["vertical", "horizontal", "wrap"];
      for (const dir of directions) {
        const written = writeDirection(dir);
        const read = readDirection(written as TailwindStyles);
        expect(read, `round-trip failed for ${dir}`).toBe(dir);
      }
    });

    it("should set flex-row for horizontal", () => {
      const written = writeDirection("horizontal");
      expect(written.flexDirection).toBe("flex-row");
      expect(written.flexWrap).toBeUndefined();
    });

    it("should set flex-col for vertical", () => {
      const written = writeDirection("vertical");
      expect(written.flexDirection).toBe("flex-col");
      expect(written.flexWrap).toBeUndefined();
    });

    it("should set flex-row + flex-wrap for wrap", () => {
      const written = writeDirection("wrap");
      expect(written.flexDirection).toBe("flex-row");
      expect(written.flexWrap).toBe("flex-wrap");
    });

    it("should default to vertical when no direction set", () => {
      const read = readDirection({} as TailwindStyles);
      expect(read).toBe("vertical");
    });
  });

  describe("writeAlignment / readAlignment", () => {
    it("should round-trip center-center", () => {
      const written = writeAlignment("center-center");
      expect(written.justifyContent).toBe("justify-center");
      expect(written.alignItems).toBe("items-center");
      const read = readAlignment(written as TailwindStyles);
      expect(read).toBe("center-center");
    });

    it("should round-trip top-left", () => {
      const written = writeAlignment("top-left");
      expect(written.justifyContent).toBe("justify-start");
      expect(written.alignItems).toBe("items-start");
      const read = readAlignment(written as TailwindStyles);
      expect(read).toBe("top-left");
    });

    it("should round-trip bottom-right", () => {
      const written = writeAlignment("bottom-right");
      expect(written.justifyContent).toBe("justify-end");
      expect(written.alignItems).toBe("items-end");
      const read = readAlignment(written as TailwindStyles);
      expect(read).toBe("bottom-right");
    });

    it("should round-trip top-center", () => {
      const written = writeAlignment("top-center");
      const read = readAlignment(written as TailwindStyles);
      expect(read).toBe("top-center");
    });

    it("should round-trip center-left", () => {
      const written = writeAlignment("center-left");
      const read = readAlignment(written as TailwindStyles);
      expect(read).toBe("center-left");
    });

    it("should round-trip bottom-center", () => {
      const written = writeAlignment("bottom-center");
      const read = readAlignment(written as TailwindStyles);
      expect(read).toBe("bottom-center");
    });
  });

  describe("writeSpaceBetween / readSpaceBetween", () => {
    it("should set justify-between when true", () => {
      const written = writeSpaceBetween(true);
      expect(written.justifyContent).toBe("justify-between");
      const read = readSpaceBetween(written as TailwindStyles);
      expect(read).toBe(true);
    });

    it("should clear justifyContent when false", () => {
      const written = writeSpaceBetween(false);
      expect(written).toHaveProperty("justifyContent");
      expect(written.justifyContent).toBeUndefined();
      const read = readSpaceBetween(written as TailwindStyles);
      expect(read).toBe(false);
    });
  });

  describe("writeClipContent / readClipContent", () => {
    it("should set overflow-hidden when true", () => {
      const written = writeClipContent(true);
      expect(written.overflow).toBe("overflow-hidden");
      const read = readClipContent(written as TailwindStyles);
      expect(read).toBe(true);
    });

    it("should clear overflow when false", () => {
      const written = writeClipContent(false);
      expect(written.overflow).toBeUndefined();
      const read = readClipContent(written as TailwindStyles);
      expect(read).toBe(false);
    });
  });
});

// ============================================================================
// POSITION ADAPTERS
// ============================================================================

describe("Position Adapters", () => {
  describe("writePositionType / readPositionType", () => {
    it("should round-trip all position types", () => {
      const types: Array<"static" | "relative" | "absolute" | "fixed" | "sticky"> = [
        "static",
        "relative",
        "absolute",
        "fixed",
        "sticky",
      ];
      for (const type of types) {
        const written = writePositionType(type);
        const read = readPositionType(written as TailwindStyles);
        expect(read).toBe(type);
      }
    });

    it("should clear position for static", () => {
      const written = writePositionType("static");
      expect(written.position).toBeUndefined();
    });

    it("should default to static when no position set", () => {
      const read = readPositionType({} as TailwindStyles);
      expect(read).toBe("static");
    });
  });

  describe("writeConstraint / readConstraint", () => {
    it("should round-trip constraint values", () => {
      const sides: Array<"top" | "right" | "bottom" | "left"> = ["top", "right", "bottom", "left"];

      for (const side of sides) {
        const written = writeConstraint(side, 16);
        expect(written[side]).toBe(`${side}-4`);
        const read = readConstraint(written as TailwindStyles, side);
        expect(read).toBe(16);
      }
    });

    it("should handle 0 constraint", () => {
      const written = writeConstraint("top", 0);
      expect(written.top).toBe("top-0");
      const read = readConstraint(written as TailwindStyles, "top");
      expect(read).toBe(0);
    });

    it("should handle arbitrary constraint values", () => {
      const written = writeConstraint("left", 15);
      expect(written.left).toBe("left-[15px]");
      expectArbitrary(written.left, "left");
    });

    it("should clear constraint when undefined", () => {
      const written = writeConstraint("top", undefined);
      expect(written.top).toBeUndefined();
    });

    it("should return undefined when no constraint set", () => {
      const read = readConstraint({} as TailwindStyles, "top");
      expect(read).toBeUndefined();
    });
  });

  describe("readPins", () => {
    it("should detect pinned sides", () => {
      const pins = readPins({ top: "top-0", left: "left-0" } as TailwindStyles);
      expect(pins.top).toBe(true);
      expect(pins.left).toBe(true);
      expect(pins.right).toBe(false);
      expect(pins.bottom).toBe(false);
    });

    it("should detect no pins", () => {
      const pins = readPins({} as TailwindStyles);
      expect(pins.top).toBe(false);
      expect(pins.right).toBe(false);
      expect(pins.bottom).toBe(false);
      expect(pins.left).toBe(false);
    });
  });

  describe("writeRotation / readRotation", () => {
    it("should round-trip standard rotation values", () => {
      const degrees = [0, 1, 2, 3, 6, 12, 45, 90, 180];
      for (const deg of degrees) {
        const written = writeRotation(deg);
        const read = readRotation(written as TailwindStyles);
        expect(read, `round-trip failed for ${deg} degrees`).toBe(deg);
      }
    });

    it("should round-trip negative rotation values", () => {
      const degrees = [-1, -2, -3, -6, -12, -45, -90, -180];
      for (const deg of degrees) {
        const written = writeRotation(deg);
        const read = readRotation(written as TailwindStyles);
        expect(read, `round-trip failed for ${deg} degrees`).toBe(deg);
      }
    });

    it("should use arbitrary values for non-standard angles", () => {
      const written = writeRotation(37);
      expect(written.rotate).toBe("rotate-[37deg]");
      const read = readRotation(written as TailwindStyles);
      expect(read).toBe(37);
    });

    it("should use arbitrary values for negative non-standard angles", () => {
      const written = writeRotation(-37);
      expect(written.rotate).toBe("-rotate-[37deg]");
      const read = readRotation(written as TailwindStyles);
      expect(read).toBe(-37);
    });

    it("should clear rotation for 0", () => {
      const written = writeRotation(0);
      expect(written.rotate).toBeUndefined();
      const read = readRotation({} as TailwindStyles);
      expect(read).toBe(0);
    });
  });

  describe("writeFlipHorizontal / readFlipHorizontal", () => {
    it("should set -scale-x-100 when flipped", () => {
      const written = writeFlipHorizontal(true);
      expect(written.scaleX).toBe("-scale-x-100");
      const read = readFlipHorizontal(written as TailwindStyles);
      expect(read).toBe(true);
    });

    it("should clear scaleX when not flipped", () => {
      const written = writeFlipHorizontal(false);
      expect(written.scaleX).toBeUndefined();
      const read = readFlipHorizontal(written as TailwindStyles);
      expect(read).toBe(false);
    });
  });

  describe("writeFlipVertical / readFlipVertical", () => {
    it("should set -scale-y-100 when flipped", () => {
      const written = writeFlipVertical(true);
      expect(written.scaleY).toBe("-scale-y-100");
      const read = readFlipVertical(written as TailwindStyles);
      expect(read).toBe(true);
    });

    it("should clear scaleY when not flipped", () => {
      const written = writeFlipVertical(false);
      expect(written.scaleY).toBeUndefined();
      const read = readFlipVertical(written as TailwindStyles);
      expect(read).toBe(false);
    });
  });

  describe("readStickyEdge / readStickyValue", () => {
    it("should detect top as sticky edge", () => {
      const edge = readStickyEdge({ top: "top-4" } as TailwindStyles);
      expect(edge).toBe("top");
    });

    it("should detect right as sticky edge", () => {
      const edge = readStickyEdge({ right: "right-0" } as TailwindStyles);
      expect(edge).toBe("right");
    });

    it("should detect bottom as sticky edge", () => {
      const edge = readStickyEdge({ bottom: "bottom-2" } as TailwindStyles);
      expect(edge).toBe("bottom");
    });

    it("should detect left as sticky edge", () => {
      const edge = readStickyEdge({ left: "left-4" } as TailwindStyles);
      expect(edge).toBe("left");
    });

    it("should default to top when no edge set", () => {
      const edge = readStickyEdge({} as TailwindStyles);
      expect(edge).toBe("top");
    });

    it("should read sticky value", () => {
      const val = readStickyValue({ top: "top-4" } as TailwindStyles);
      expect(val).toBe(16);
    });

    it("should default to 0 when no sticky value", () => {
      const val = readStickyValue({} as TailwindStyles);
      expect(val).toBe(0);
    });
  });
});

// ============================================================================
// EFFECTS: SHADOW
// ============================================================================

describe("Shadow Adapters", () => {
  describe("writeShadow / readShadow", () => {
    it("should round-trip outside shadow presets", () => {
      const presets = ["shadow-xs", "shadow-sm", "shadow", "shadow-md", "shadow-lg", "shadow-xl", "shadow-2xl"];

      for (const preset of presets) {
        const shadowVal = readShadow({ shadow: preset } as TailwindStyles);
        expect(shadowVal, `readShadow failed for ${preset}`).not.toBeNull();
        expect(shadowVal!.type).toBe("outside");

        const written = writeShadow(shadowVal!);
        // Re-read: should get same shadow values
        const readBack = readShadow(written as TailwindStyles);
        expect(readBack).not.toBeNull();
        expect(readBack!.elevation).toBe(shadowVal!.elevation);
      }
    });

    it("should round-trip inside shadow presets", () => {
      const presets = ["inset-shadow-xs", "inset-shadow-sm", "inset-shadow", "inset-shadow-md", "inset-shadow-lg"];

      for (const preset of presets) {
        const shadowVal = readShadow({ insetShadow: preset } as TailwindStyles);
        expect(shadowVal, `readShadow failed for ${preset}`).not.toBeNull();
        expect(shadowVal!.type).toBe("inside");

        const written = writeShadow(shadowVal!);
        const readBack = readShadow(written as TailwindStyles);
        expect(readBack).not.toBeNull();
        expect(readBack!.type).toBe("inside");
      }
    });

    it("should return null for shadow-none", () => {
      const read = readShadow({ shadow: "shadow-none" } as TailwindStyles);
      expect(read).toBeNull();
    });

    it("should return null for inset-shadow-none", () => {
      const read = readShadow({ insetShadow: "inset-shadow-none" } as TailwindStyles);
      expect(read).toBeNull();
    });

    it("should return null when no shadow set", () => {
      const read = readShadow({} as TailwindStyles);
      expect(read).toBeNull();
    });

    it("should clear both shadow fields when null", () => {
      const written = writeShadow(null);
      expect(written.shadow).toBeUndefined();
      expect(written.insetShadow).toBeUndefined();
    });

    it("should write inside shadow and clear outside", () => {
      const shadow = { type: "inside" as const, angle: 90, distance: 8, brightness: 5, elevation: 30, color: "#000000", opacity: 8 };
      const written = writeShadow(shadow);
      expect(written.shadow).toBeUndefined();
      expect(written.insetShadow).toBeDefined();
    });

    it("should write outside shadow and clear inside", () => {
      const shadow = { type: "outside" as const, angle: 90, distance: 12, brightness: 8, elevation: 50, color: "#000000", opacity: 10 };
      const written = writeShadow(shadow);
      expect(written.shadow).toBeDefined();
      expect(written.insetShadow).toBeUndefined();
    });

    it("should round-trip shadow color", () => {
      const shadow = { type: "outside" as const, angle: 90, distance: 36, brightness: 10, elevation: 100, color: "#ff0000", opacity: 15 };
      const written = writeShadow(shadow);
      const read = readShadow(written as TailwindStyles);
      expect(read).not.toBeNull();
      expect(read!.color).toBe("#ff0000");
    });

    it("should round-trip shadow opacity", () => {
      const shadow = { type: "outside" as const, angle: 90, distance: 36, brightness: 10, elevation: 100, color: "#000000", opacity: 50 };
      const written = writeShadow(shadow);
      const read = readShadow(written as TailwindStyles);
      expect(read).not.toBeNull();
      expect(read!.opacity).toBe(50);
    });

    it("should round-trip inset shadow color", () => {
      const shadow = { type: "inside" as const, angle: 90, distance: 12, brightness: 8, elevation: 50, color: "#00ff00", opacity: 10 };
      const written = writeShadow(shadow);
      const read = readShadow(written as TailwindStyles);
      expect(read).not.toBeNull();
      expect(read!.color).toBe("#00ff00");
    });
  });

  // ==========================================================================
  // BUG REPRODUCTION TESTS: Custom shadow values lost on round-trip
  // The current implementation snaps to presets, losing custom angle/distance/brightness.
  // ==========================================================================
  describe("custom value round-trip bugs", () => {
    it("BUG: custom angle should survive write→read round-trip", () => {
      // User sets angle to 45° (not the preset default of 90°)
      const shadow: ShadowValue = {
        type: "outside", angle: 45, distance: 36, brightness: 10, elevation: 100, color: "#000000", opacity: 15,
      };
      const written = writeShadow(shadow);
      const read = readShadow(written as TailwindStyles);
      expect(read).not.toBeNull();
      // This FAILS: readShadow returns preset angle (90) instead of custom angle (45)
      expect(read!.angle).toBe(45);
    });

    it("BUG: custom brightness should survive write→read round-trip", () => {
      // User sets brightness to 50 (preset shadow-xl has brightness: 10)
      const shadow: ShadowValue = {
        type: "outside", angle: 90, distance: 36, brightness: 50, elevation: 100, color: "#000000", opacity: 15,
      };
      const written = writeShadow(shadow);
      const read = readShadow(written as TailwindStyles);
      expect(read).not.toBeNull();
      // This FAILS: readShadow returns preset brightness (10) instead of custom (50)
      expect(read!.brightness).toBe(50);
    });

    it("BUG: custom distance should survive write→read round-trip", () => {
      // User sets distance to 25 (between shadow-md:20 and shadow-lg:30)
      const shadow: ShadowValue = {
        type: "outside", angle: 90, distance: 25, brightness: 8, elevation: 60, color: "#000000", opacity: 10,
      };
      const written = writeShadow(shadow);
      const read = readShadow(written as TailwindStyles);
      expect(read).not.toBeNull();
      // This FAILS: readShadow returns the closest preset's distance, not 25
      expect(read!.distance).toBe(25);
    });

    it("BUG: changing only elevation should NOT change brightness or distance", () => {
      // Start with shadow-md values (elevation:60, distance:20, brightness:8)
      const baseShadow: ShadowValue = {
        type: "outside", angle: 90, distance: 20, brightness: 8, elevation: 60, color: "#000000", opacity: 10,
      };

      // User changes elevation from 60 → 80 (which is shadow-lg's elevation)
      const modified: ShadowValue = { ...baseShadow, elevation: 80 };
      const written = writeShadow(modified);
      const read = readShadow(written as TailwindStyles);
      expect(read).not.toBeNull();

      // Distance should stay at 20 (user didn't change it)
      // This FAILS: snaps to shadow-lg preset which has distance:30
      expect(read!.distance).toBe(20);

      // Brightness should stay at 8 (user didn't change it)
      // This FAILS: snaps to shadow-lg preset which has brightness:10
      expect(read!.brightness).toBe(8);
    });

    it("BUG: all custom ShadowValue fields should round-trip accurately", () => {
      // A fully custom shadow that doesn't match any preset exactly
      const shadow: ShadowValue = {
        type: "outside",
        angle: 135,
        distance: 18,
        brightness: 42,
        elevation: 70,
        color: "#ff5500",
        opacity: 30,
      };
      const written = writeShadow(shadow);
      const read = readShadow(written as TailwindStyles);
      expect(read).not.toBeNull();
      expect(read!.angle).toBe(135);
      expect(read!.distance).toBe(18);
      expect(read!.brightness).toBe(42);
      expect(read!.elevation).toBe(70);
      expect(read!.color).toBe("#ff5500");
      expect(read!.opacity).toBe(30);
    });
  });

  describe("inset shadow preset completeness", () => {
    it("BUG: writeShadow for inside type should produce a key that exists in INSET_SHADOW_PRESETS", () => {
      // Every inset preset in the adapter should be a valid key
      // This tests that the canvas can look up any inset shadow the adapter produces
      const insetKeys = Object.keys(INSET_SHADOW_PRESETS).filter(k => k !== "inset-shadow-none");
      expect(insetKeys.length).toBeGreaterThan(0);

      for (const key of insetKeys) {
        const shadowVal = readShadow({ insetShadow: key } as TailwindStyles);
        expect(shadowVal, `readShadow returned null for ${key}`).not.toBeNull();
        expect(shadowVal!.type).toBe("inside");

        // Write it back and verify the written key is a valid inset preset
        const written = writeShadow(shadowVal!);
        expect(written.insetShadow, `writeShadow didn't produce insetShadow for ${key}`).toBeDefined();
        expect(
          written.insetShadow! in INSET_SHADOW_PRESETS,
          `writeShadow produced "${written.insetShadow}" which is not in INSET_SHADOW_PRESETS`
        ).toBe(true);
      }
    });

    it("BUG: default inside shadow should round-trip through writeShadow", () => {
      // When user switches to "inside" type, the default shadow should work
      const insideShadow: ShadowValue = {
        type: "inside", angle: 90, distance: 12, brightness: 8, elevation: 50,
        color: "#000000", opacity: 10,
      };
      const written = writeShadow(insideShadow);
      expect(written.insetShadow).toBeDefined();
      expect(written.shadow).toBeUndefined();

      const read = readShadow(written as TailwindStyles);
      expect(read).not.toBeNull();
      expect(read!.type).toBe("inside");
      expect(read!.elevation).toBe(50);
      expect(read!.distance).toBe(12);
    });
  });
});

// ============================================================================
// EFFECTS: FILTERS
// ============================================================================

describe("Filter Adapters", () => {
  describe("readFilters", () => {
    it("should return stable IDs across multiple calls with the same input", () => {
      const styles: TailwindStyles = {
        blur: "blur-md",
      } as TailwindStyles;

      const first = readFilters(styles);
      const second = readFilters(styles);

      expect(first.length).toBeGreaterThan(0);
      expect(second.length).toBe(first.length);

      for (let i = 0; i < first.length; i++) {
        expect(
          second[i].id,
          `Filter ID changed between calls: "${first[i].id}" -> "${second[i].id}"`
        ).toBe(first[i].id);
      }
    });

    it("should return stable IDs even after many render cycles", () => {
      const styles: TailwindStyles = {
        brightness: "brightness-150",
        contrast: "contrast-125",
      } as TailwindStyles;

      const results = Array.from({ length: 10 }, () => readFilters(styles));
      const firstIds = results[0].map((f) => f.id);
      for (let cycle = 1; cycle < results.length; cycle++) {
        const ids = results[cycle].map((f) => f.id);
        expect(ids).toEqual(firstIds);
      }
    });

    it("should read blur filter", () => {
      const items = readFilters({ blur: "blur-md" } as TailwindStyles);
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe("blur");
      expect(items[0].target).toBe("layer");
      expect(items[0].value).toBe("12");
    });

    it("should read backdrop blur filter", () => {
      const items = readFilters({ backdropBlur: "backdrop-blur-lg" } as TailwindStyles);
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe("blur");
      expect(items[0].target).toBe("backdrop");
      expect(items[0].value).toBe("16");
    });

    it("should read brightness filter", () => {
      const items = readFilters({ brightness: "brightness-150" } as TailwindStyles);
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe("brightness");
      expect(items[0].value).toBe("150");
    });

    it("should read contrast filter", () => {
      const items = readFilters({ contrast: "contrast-125" } as TailwindStyles);
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe("contrast");
      expect(items[0].value).toBe("125");
    });

    it("should read hueRotate filter", () => {
      const items = readFilters({ hueRotate: "hue-rotate-90" } as TailwindStyles);
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe("hueRotate");
      expect(items[0].value).toBe("90");
    });

    it("should read invert filter", () => {
      const items = readFilters({ invert: "invert" } as TailwindStyles);
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe("invert");
      expect(items[0].value).toBe("100");
    });

    it("should read saturate filter", () => {
      const items = readFilters({ saturate: "saturate-200" } as TailwindStyles);
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe("saturate");
      expect(items[0].value).toBe("200");
    });

    it("should read sepia filter", () => {
      const items = readFilters({ sepia: "sepia" } as TailwindStyles);
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe("sepia");
      expect(items[0].value).toBe("100");
    });

    it("should skip none values", () => {
      const items = readFilters({ blur: "blur-none" } as TailwindStyles);
      expect(items).toHaveLength(0);
    });

    it("should preserve -0 values (explicit zero filters are valid)", () => {
      const items = readFilters({ invert: "invert-0" } as TailwindStyles);
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe("invert");
      expect(items[0].value).toBe("0");
    });

    it("should read multiple filters at once", () => {
      const items = readFilters({
        blur: "blur-md",
        brightness: "brightness-150",
        contrast: "contrast-75",
      } as TailwindStyles);
      expect(items).toHaveLength(3);
      const types = items.map((i) => i.type);
      expect(types).toContain("blur");
      expect(types).toContain("brightness");
      expect(types).toContain("contrast");
    });

    it("should read backdrop filters", () => {
      const items = readFilters({
        backdropBrightness: "backdrop-brightness-150",
        backdropContrast: "backdrop-contrast-125",
      } as TailwindStyles);
      expect(items).toHaveLength(2);
      expect(items[0].target).toBe("backdrop");
      expect(items[1].target).toBe("backdrop");
    });

    it("should return empty array for no filters", () => {
      const items = readFilters({} as TailwindStyles);
      expect(items).toHaveLength(0);
    });
  });

  describe("writeFilters / readFilters round-trip", () => {
    it("should round-trip layer blur", () => {
      const filter = { id: "f1", type: "blur" as const, value: "12", target: "layer" as const, visible: true };
      const written = writeFilters([filter]);
      expect(written.blur).toBe("blur-md");
      const items = readFilters(written as TailwindStyles);
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe("blur");
      expect(items[0].value).toBe("12");
    });

    it("should round-trip backdrop blur", () => {
      const filter = { id: "f1", type: "blur" as const, value: "24", target: "backdrop" as const, visible: true };
      const written = writeFilters([filter]);
      expect(written.backdropBlur).toBe("backdrop-blur-xl");
      const items = readFilters(written as TailwindStyles);
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe("blur");
      expect(items[0].target).toBe("backdrop");
      expect(items[0].value).toBe("24");
    });

    it("should round-trip brightness", () => {
      const filter = { id: "f1", type: "brightness" as const, value: "150", target: "layer" as const, visible: true };
      const written = writeFilters([filter]);
      expect(written.brightness).toBe("brightness-150");
      const items = readFilters(written as TailwindStyles);
      expect(items[0].value).toBe("150");
    });

    it("should round-trip contrast", () => {
      const filter = { id: "f1", type: "contrast" as const, value: "125", target: "layer" as const, visible: true };
      const written = writeFilters([filter]);
      expect(written.contrast).toBe("contrast-125");
    });

    it("should round-trip hueRotate", () => {
      const filter = { id: "f1", type: "hueRotate" as const, value: "90", target: "layer" as const, visible: true };
      const written = writeFilters([filter]);
      expect(written.hueRotate).toBe("hue-rotate-90");
    });

    it("should round-trip invert", () => {
      const filter = { id: "f1", type: "invert" as const, value: "100", target: "layer" as const, visible: true };
      const written = writeFilters([filter]);
      expect(written.invert).toBe("invert");

      const off = { id: "f1", type: "invert" as const, value: "0", target: "layer" as const, visible: true };
      const writtenOff = writeFilters([off]);
      expect(writtenOff.invert).toBe("invert-0");
    });

    it("should round-trip saturate", () => {
      const filter = { id: "f1", type: "saturate" as const, value: "200", target: "layer" as const, visible: true };
      const written = writeFilters([filter]);
      expect(written.saturate).toBe("saturate-200");
    });

    it("should round-trip sepia", () => {
      const filter = { id: "f1", type: "sepia" as const, value: "100", target: "layer" as const, visible: true };
      const written = writeFilters([filter]);
      expect(written.sepia).toBe("sepia");

      const off = { id: "f1", type: "sepia" as const, value: "0", target: "layer" as const, visible: true };
      const writtenOff = writeFilters([off]);
      expect(writtenOff.sepia).toBe("sepia-0");
    });

    it("should round-trip backdrop invert", () => {
      const filter = { id: "f1", type: "invert" as const, value: "100", target: "backdrop" as const, visible: true };
      const written = writeFilters([filter]);
      expect(written.backdropInvert).toBe("backdrop-invert");
    });

    it("should round-trip backdrop sepia", () => {
      const filter = { id: "f1", type: "sepia" as const, value: "100", target: "backdrop" as const, visible: true };
      const written = writeFilters([filter]);
      expect(written.backdropSepia).toBe("backdrop-sepia");
    });

    it("should preserve invisible filters but track them as hidden", () => {
      const filter = { id: "f1", type: "blur" as const, value: "12", target: "layer" as const, visible: false };
      const written = writeFilters([filter]);
      expect(written.blur).toBe("blur-md");
      expect(written.hiddenFilters).toBe(JSON.stringify(["layer-blur"]));
    });

    it("should clear all filter fields when given empty array", () => {
      const written = writeFilters([]);
      expect(written.blur).toBeUndefined();
      expect(written.backdropBlur).toBeUndefined();
      expect(written.brightness).toBeUndefined();
      expect(written.contrast).toBeUndefined();
      expect(written.hueRotate).toBeUndefined();
      expect(written.invert).toBeUndefined();
      expect(written.saturate).toBeUndefined();
      expect(written.sepia).toBeUndefined();
      expect(written.backdropBrightness).toBeUndefined();
      expect(written.backdropContrast).toBeUndefined();
      expect(written.backdropHueRotate).toBeUndefined();
      expect(written.backdropInvert).toBeUndefined();
      expect(written.backdropSaturate).toBeUndefined();
      expect(written.backdropSepia).toBeUndefined();
    });

    it("should use arbitrary value for non-standard blur", () => {
      const filter = { id: "f1", type: "blur" as const, value: "5", target: "layer" as const, visible: true };
      const written = writeFilters([filter]);
      expect(written.blur).toBe("blur-[5px]");
    });
  });
});

// ============================================================================
// FILL ADAPTERS
// ============================================================================

describe("Fill Adapters", () => {
  describe("writeFills / readFills", () => {
    it("should write a fill with bg- prefix", () => {
      const written = writeFills([{ id: "f1", color: "red-500", opacity: 100, visible: true }]);
      expect(written.backgroundColor).toBe("bg-red-500");
    });

    it("should read fills and strip bg- prefix", () => {
      const fills = readFills({ backgroundColor: "bg-blue-500" } as TailwindStyles);
      expect(fills).toHaveLength(1);
      expect(fills[0].color).toBe("blue-500");
      expect(fills[0].opacity).toBe(100);
      expect(fills[0].visible).toBe(true);
    });

    it("should clear backgroundColor when fills is empty", () => {
      const written = writeFills([]);
      expect(written.backgroundColor).toBeUndefined();
    });

    it("should preserve backgroundColor when fill is hidden (visible: false)", () => {
      // BUG: writeFills clears backgroundColor when visible=false, causing readFills
      // to return [] on next read — the fill disappears from the UI entirely
      const written = writeFills([{ id: "f1", color: "#ff0000", opacity: 100, visible: false }]);
      // backgroundColor should still be stored so the fill row persists in the UI
      expect(written.backgroundColor).toBeDefined();
    });

    it("should round-trip a hidden fill without losing it", () => {
      // BUG: write(hidden fill) → clears bg → read() → [] (fill gone)
      // Expected: write(hidden fill) → stores bg + hidden flag → read() → [fill with visible:false]
      const hidden: FillItem = { id: "f1", color: "#ff0000", opacity: 100, visible: false };
      const written = writeFills([hidden]);
      const readBack = readFills(written as TailwindStyles);
      expect(readBack).toHaveLength(1);
      expect(readBack[0].color).toBe("#ff0000");
      expect(readBack[0].visible).toBe(false);
    });

    it("should return empty array when no backgroundColor", () => {
      const fills = readFills({} as TailwindStyles);
      expect(fills).toHaveLength(0);
    });

    it("should not double-prefix bg-", () => {
      const written = writeFills([{ id: "f1", color: "bg-green-500", opacity: 100, visible: true }]);
      expect(written.backgroundColor).toBe("bg-green-500");
    });

    // ── Gradient round-trip tests ──────────────────────────────────────
    it("should round-trip a linear gradient fill", () => {
      const fill: FillItem = {
        id: "f1",
        color: "#ff0000",
        opacity: 100,
        visible: true,
        gradient: {
          type: "linear",
          angle: 180,
          stops: [
            { color: "#ff0000", position: 0 },
            { color: "#0000ff", position: 1 },
          ],
        },
      };
      const written = writeFills([fill]);
      // Should write gradient fields to TailwindStyles
      expect(written.backgroundGradient).toBeDefined();
      expect(written.gradientFrom).toBeDefined();
      expect(written.gradientTo).toBeDefined();
      // Round-trip: read back should reconstruct gradient
      const readBack = readFills(written as TailwindStyles);
      expect(readBack).toHaveLength(1);
      expect(readBack[0].gradient).toBeDefined();
      expect(readBack[0].gradient!.type).toBe("linear");
      expect(readBack[0].gradient!.stops).toHaveLength(2);
      expect(readBack[0].gradient!.stops[0].color).toBe("#ff0000");
      expect(readBack[0].gradient!.stops[1].color).toBe("#0000ff");
    });

    it("should write gradient direction class for common angles", () => {
      const fill: FillItem = {
        id: "f1",
        color: "#ff0000",
        opacity: 100,
        visible: true,
        gradient: {
          type: "linear",
          angle: 90,
          stops: [
            { color: "#ff0000", position: 0 },
            { color: "#00ff00", position: 1 },
          ],
        },
      };
      const written = writeFills([fill]);
      // angle 90 → "to right" → bg-linear-to-r
      expect(written.backgroundGradient).toBe("bg-linear-to-r");
    });

    it("should explicitly clear gradient fields when switching back to solid fill", () => {
      // First write a gradient fill — these fields would be set in TailwindStyles
      const gradientFill: FillItem = {
        id: "f1",
        color: "#ff0000",
        opacity: 100,
        visible: true,
        gradient: {
          type: "linear",
          angle: 180,
          stops: [
            { color: "#ff0000", position: 0 },
            { color: "#0000ff", position: 1 },
          ],
        },
      };
      const withGradient = writeFills([gradientFill]);
      expect(withGradient.backgroundGradient).toBeDefined();

      // Now switch to solid (no gradient property) — gradient fields must be explicitly cleared
      const solidFill: FillItem = {
        id: "f1",
        color: "#ff0000",
        opacity: 100,
        visible: true,
      };
      const withSolid = writeFills([solidFill]);
      expect(withSolid.backgroundGradient).toBeUndefined();
      expect(withSolid.gradientFrom).toBeUndefined();
      expect(withSolid.gradientVia).toBeUndefined();
      expect(withSolid.gradientTo).toBeUndefined();
    });

    it("should write 3-stop gradient with via color", () => {
      const fill: FillItem = {
        id: "f1",
        color: "#ff0000",
        opacity: 100,
        visible: true,
        gradient: {
          type: "linear",
          angle: 180,
          stops: [
            { color: "#ff0000", position: 0 },
            { color: "#00ff00", position: 0.5 },
            { color: "#0000ff", position: 1 },
          ],
        },
      };
      const written = writeFills([fill]);
      expect(written.gradientFrom).toBeDefined();
      expect(written.gradientVia).toBeDefined();
      expect(written.gradientTo).toBeDefined();
    });

    it("should round-trip gradient stop opacity", () => {
      const fill: FillItem = {
        id: "f1",
        color: "#ff0000",
        opacity: 100,
        visible: true,
        gradient: {
          type: "linear",
          angle: 180,
          stops: [
            { color: "#ff0000", position: 0, opacity: 50 },
            { color: "#0000ff", position: 1, opacity: 75 },
          ],
        },
      };
      const written = writeFills([fill]);
      // The gradient color classes should include opacity modifiers
      expect(written.gradientFrom).toContain("/50");
      expect(written.gradientTo).toContain("/75");
      // Read back should preserve stop opacity
      const readBack = readFills(written as TailwindStyles);
      expect(readBack).toHaveLength(1);
      expect(readBack[0].gradient).toBeDefined();
      expect(readBack[0].gradient!.stops[0].opacity).toBe(50);
      expect(readBack[0].gradient!.stops[1].opacity).toBe(75);
    });

    it("should omit opacity modifier when gradient stop opacity is 100", () => {
      const fill: FillItem = {
        id: "f1",
        color: "#ff0000",
        opacity: 100,
        visible: true,
        gradient: {
          type: "linear",
          angle: 180,
          stops: [
            { color: "#ff0000", position: 0, opacity: 100 },
            { color: "#0000ff", position: 1 },
          ],
        },
      };
      const written = writeFills([fill]);
      expect(written.gradientFrom).toBe("from-[#ff0000]");
      expect(written.gradientTo).toBe("to-[#0000ff]");
    });

    it("should round-trip 3-stop gradient with via opacity", () => {
      const fill: FillItem = {
        id: "f1",
        color: "#ff0000",
        opacity: 100,
        visible: true,
        gradient: {
          type: "linear",
          angle: 180,
          stops: [
            { color: "#ff0000", position: 0, opacity: 100 },
            { color: "#00ff00", position: 0.5, opacity: 30 },
            { color: "#0000ff", position: 1, opacity: 100 },
          ],
        },
      };
      const written = writeFills([fill]);
      expect(written.gradientVia).toContain("/30");
      const readBack = readFills(written as TailwindStyles);
      expect(readBack[0].gradient!.stops[1].opacity).toBe(30);
    });

    it("should not produce duplicate fill rows when gradient is set", () => {
      // BUG: switching to gradient mode was creating an extra fill row
      const fill: FillItem = {
        id: "f1",
        color: "#ff0000",
        opacity: 100,
        visible: true,
        gradient: {
          type: "linear",
          angle: 180,
          stops: [
            { color: "#ff0000", position: 0 },
            { color: "#0000ff", position: 1 },
          ],
        },
      };
      const written = writeFills([fill]);
      const readBack = readFills(written as TailwindStyles);
      // Should be exactly 1 fill, not 2
      expect(readBack).toHaveLength(1);
    });
  });

  describe("multi-fill support", () => {
    it("should round-trip multiple fills", () => {
      const fills: FillItem[] = [
        { id: "f1", color: "#000000", opacity: 20, visible: true },
        { id: "f2", color: "#ffffff", opacity: 100, visible: true },
      ];
      const written = writeFills(fills);
      const readBack = readFills(written as TailwindStyles);
      expect(readBack).toHaveLength(2);
      expect(readBack[0].color).toBe("#000000");
      expect(readBack[0].opacity).toBe(20);
      expect(readBack[1].color).toBe("#ffffff");
      expect(readBack[1].opacity).toBe(100);
    });

    it("should preserve fill order", () => {
      const fills: FillItem[] = [
        { id: "f1", color: "red-500", opacity: 100, visible: true },
        { id: "f2", color: "blue-500", opacity: 50, visible: true },
        { id: "f3", color: "#00ff00", opacity: 75, visible: true },
      ];
      const written = writeFills(fills);
      const readBack = readFills(written as TailwindStyles);
      expect(readBack).toHaveLength(3);
      expect(readBack[0].color).toBe("red-500");
      expect(readBack[1].color).toBe("blue-500");
      expect(readBack[1].opacity).toBe(50);
      expect(readBack[2].color).toBe("#00ff00");
    });

    it("should handle single fill without backgroundFills field (backwards compat)", () => {
      // Old data without backgroundFills should still work via backgroundColor
      const fills = readFills({ backgroundColor: "bg-red-500" } as TailwindStyles);
      expect(fills).toHaveLength(1);
      expect(fills[0].color).toBe("red-500");
    });

    it("should handle mixed visible/hidden fills", () => {
      const fills: FillItem[] = [
        { id: "f1", color: "#000000", opacity: 100, visible: false },
        { id: "f2", color: "#ffffff", opacity: 100, visible: true },
      ];
      const written = writeFills(fills);
      const readBack = readFills(written as TailwindStyles);
      expect(readBack).toHaveLength(2);
      expect(readBack[0].visible).toBe(false);
      expect(readBack[1].visible).toBe(true);
    });
  });

  describe("writeTextFills / readTextFills", () => {
    it("should round-trip a hidden text fill without losing it", () => {
      // BUG: writeTextFills clears textColor when visible=false, then readTextFills returns []
      const hidden: FillItem = { id: "f1", color: "#ff0000", opacity: 100, visible: false };
      const written = writeTextFills([hidden]);
      const readBack = readTextFills(written as TailwindStyles);
      expect(readBack).toHaveLength(1);
      expect(readBack[0].color).toBe("#ff0000");
      expect(readBack[0].visible).toBe(false);
    });

    it("should write and read text color correctly", () => {
      const fill: FillItem = { id: "f1", color: "#333333", opacity: 100, visible: true };
      const written = writeTextFills([fill]);
      expect(written.textColor).toBe("text-[#333333]");
      const readBack = readTextFills(written as TailwindStyles);
      expect(readBack).toHaveLength(1);
      expect(readBack[0].color).toBe("#333333");
      expect(readBack[0].visible).toBe(true);
    });

    it("should clear textColor when fills is empty", () => {
      const written = writeTextFills([]);
      expect(written.textColor).toBeUndefined();
    });
  });
});

// ============================================================================
// EXTRACTION REGEX TESTS
// ============================================================================

describe("Extraction Regex Compatibility", () => {
  const ARB_DIM_TO_CSS_PREFIXES = [
    "w", "h", "min-w", "min-h", "max-w", "max-h",
    "gap", "gap-x", "gap-y",
    "p", "px", "py", "pt", "pr", "pb", "pl",
    "m", "mx", "my", "mt", "mr", "mb", "ml",
    "top", "right", "bottom", "left", "inset",
    "text", "leading", "tracking",
    "rounded", "rounded-tl", "rounded-tr", "rounded-bl", "rounded-br",
    "opacity",
    "border", "border-t", "border-r", "border-b", "border-l",
  ];

  it("should match all arbitrary value prefixes from ARB_DIM_TO_CSS", () => {
    for (const prefix of ARB_DIM_TO_CSS_PREFIXES) {
      const cls = `${prefix}-[42px]`;
      const match = cls.match(ARBITRARY_REGEX);
      expect(match, `"${cls}" should match the extraction regex`).not.toBeNull();
      expect(match![1]).toBe(prefix);
      expect(match![2]).toBe("42px");
    }
  });

  it("should extract correct prefix and value from writeWidth arbitrary output", () => {
    const written = writeWidth("200");
    const match = written.width!.match(ARBITRARY_REGEX);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("w");
    expect(match![2]).toBe("200px");
  });

  it("should extract correct prefix and value from writeHeight arbitrary output", () => {
    const written = writeHeight("300");
    const match = written.height!.match(ARBITRARY_REGEX);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("h");
    expect(match![2]).toBe("300px");
  });

  it("should extract correct prefix and value from writeGap arbitrary output", () => {
    const written = writeGap(15);
    const match = written.gap!.match(ARBITRARY_REGEX);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("gap");
    expect(match![2]).toBe("15px");
  });

  it("should extract correct prefix from writeCornerRadius arbitrary output", () => {
    const written = writeCornerRadius("10");
    const match = written.borderRadius!.match(ARBITRARY_REGEX);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("rounded");
    expect(match![2]).toBe("10px");
  });

  it("should extract correct prefix from writeOpacity arbitrary output", () => {
    const written = writeOpacity(37);
    const match = written.opacity!.match(ARBITRARY_REGEX);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("opacity");
    expect(match![2]).toBe("0.37");
  });

  it("should extract correct prefix from writeLetterSpacing arbitrary output", () => {
    const written = writeLetterSpacing("5%");
    const match = written.letterSpacing!.match(ARBITRARY_REGEX);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("tracking");
    expect(match![2]).toBe("0.05em");
  });

  it("should extract correct prefix from writeFontSize arbitrary output", () => {
    const written = writeFontSize("22");
    const match = written.fontSize!.match(ARBITRARY_REGEX);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("text");
    expect(match![2]).toBe("22px");
  });

  it("should extract correct prefix from writeBorder arbitrary width output", () => {
    const border = { color: "#000", opacity: 100, width: 3, style: "solid" as const, side: "all" as const };
    const written = writeBorder(border);
    const match = written.borderWidth!.match(ARBITRARY_REGEX);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("border");
    expect(match![2]).toBe("3px");
  });

  it("should extract correct prefix from writeIndividualCornerRadius arbitrary output", () => {
    const corners: Array<["TopLeft", "rounded-tl"] | ["TopRight", "rounded-tr"] | ["BottomLeft", "rounded-bl"] | ["BottomRight", "rounded-br"]> = [
      ["TopLeft", "rounded-tl"],
      ["TopRight", "rounded-tr"],
      ["BottomLeft", "rounded-bl"],
      ["BottomRight", "rounded-br"],
    ];
    for (const [corner, prefix] of corners) {
      const written = writeIndividualCornerRadius(corner, "10");
      const field = `borderRadius${corner}` as keyof typeof written;
      const cls = written[field] as string;
      const match = cls.match(ARBITRARY_REGEX);
      expect(match, `"${cls}" should match`).not.toBeNull();
      expect(match![1]).toBe(prefix);
      expect(match![2]).toBe("10px");
    }
  });

  it("should extract correct prefix from writeConstraint arbitrary output", () => {
    const sides: Array<"top" | "right" | "bottom" | "left"> = ["top", "right", "bottom", "left"];
    for (const side of sides) {
      const written = writeConstraint(side, 15);
      const cls = written[side] as string;
      const match = cls.match(ARBITRARY_REGEX);
      expect(match, `"${cls}" should match`).not.toBeNull();
      expect(match![1]).toBe(side);
      expect(match![2]).toBe("15px");
    }
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe("Edge Cases", () => {
  it("should handle all spacing scale values round-trip for gap", () => {
    const spacingPx = [0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 80, 96];
    for (const px of spacingPx) {
      const written = writeGap(px);
      const read = readGap(written as TailwindStyles);
      expect(read, `round-trip failed for ${px}px gap`).toBe(px);
    }
  });

  it("should handle all spacing scale values round-trip for padding", () => {
    const spacingPx = [0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 80, 96];
    for (const px of spacingPx) {
      const written = writePadding("x", px, "xy");
      const styles = written as TailwindStyles;
      const values = readPaddingValues(styles);
      expect(values.paddingX, `round-trip failed for ${px}px paddingX`).toBe(px);
    }
  });

  it("should handle all spacing scale values round-trip for margin", () => {
    const spacingPx = [0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 80, 96];
    for (const px of spacingPx) {
      const written = writeMargin("y", px, "xy");
      const styles = written as TailwindStyles;
      const values = readMarginValues(styles);
      expect(values.marginY, `round-trip failed for ${px}px marginY`).toBe(px);
    }
  });

  it("should handle all named size round-trips", () => {
    const specialValues = ["fill", "auto", "hug"];
    for (const val of specialValues) {
      const writtenW = writeWidth(val);
      const readW = readSize(writtenW as TailwindStyles);
      expect(readW.width, `width round-trip failed for "${val}"`).toBe(val);

      const writtenH = writeHeight(val);
      const readH = readSize(writtenH as TailwindStyles);
      expect(readH.height, `height round-trip failed for "${val}"`).toBe(val);
    }
  });

  it("should handle all blur presets round-trip", () => {
    const blurPresets: Record<string, number> = {
      "blur-none": 0, "blur-sm": 4, "blur": 8, "blur-md": 12,
      "blur-lg": 16, "blur-xl": 24, "blur-2xl": 40, "blur-3xl": 64,
    };

    for (const [cls, px] of Object.entries(blurPresets)) {
      if (cls === "blur-none") continue; // none is skipped by readFilters
      const items = readFilters({ blur: cls } as TailwindStyles);
      expect(items).toHaveLength(1);
      expect(items[0].value).toBe(String(px));

      // Write back
      const filter = { id: "f1", type: "blur" as const, value: String(px), target: "layer" as const, visible: true };
      const written = writeFilters([filter]);
      expect(written.blur).toBe(cls);
    }
  });

  it("should handle all border radius presets round-trip", () => {
    const presets: Record<string, string> = {
      "rounded-none": "0", "rounded-sm": "2", "rounded": "4",
      "rounded-md": "6", "rounded-lg": "8", "rounded-xl": "12",
      "rounded-2xl": "16", "rounded-3xl": "24", "rounded-full": "9999",
    };

    for (const [cls, px] of Object.entries(presets)) {
      const read = readCornerRadius({ borderRadius: cls } as TailwindStyles);
      expect(read, `readCornerRadius failed for ${cls}`).toBe(px);

      const written = writeCornerRadius(px);
      expect(written.borderRadius, `writeCornerRadius failed for ${px}px`).toBe(cls);
    }
  });

  it("should handle all font size presets round-trip", () => {
    const presets: Record<string, string> = {
      "text-xs": "12", "text-sm": "14", "text-base": "16",
      "text-lg": "18", "text-xl": "20", "text-2xl": "24",
      "text-3xl": "30", "text-4xl": "36", "text-5xl": "48",
      "text-6xl": "60", "text-7xl": "72", "text-8xl": "96",
      "text-9xl": "128",
    };

    for (const [cls, px] of Object.entries(presets)) {
      const read = readFontSize({ fontSize: cls } as TailwindStyles);
      expect(read).toBe(px);

      const written = writeFontSize(px);
      expect(written.fontSize).toBe(cls);
    }
  });

  it("should handle all border width presets round-trip", () => {
    const widths = [0, 1, 2, 4, 8];
    for (const w of widths) {
      const border = { color: "#000", opacity: 100, width: w, style: "solid" as const, side: "all" as const };
      const written = writeBorder(border);
      const read = readBorder(written as TailwindStyles);
      expect(read).not.toBeNull();
      expect(read!.width).toBe(w);
    }
  });
});

// ============================================================================
// TEXT FORMATTING ADAPTERS
// ============================================================================

describe("Text Formatting Adapters", () => {
  describe("writeTextDecoration / readTextDecoration", () => {
    it("should round-trip 'none' by clearing the field", () => {
      const written = writeTextDecoration("none");
      expect(written.textDecoration).toBeUndefined();
      const read = readTextDecoration(written as TailwindStyles);
      expect(read).toBe("none");
    });

    it("should round-trip 'underline'", () => {
      const written = writeTextDecoration("underline");
      expect(written.textDecoration).toBe("underline");
      const read = readTextDecoration(written as TailwindStyles);
      expect(read).toBe("underline");
    });

    it("should round-trip 'line-through'", () => {
      const written = writeTextDecoration("line-through");
      expect(written.textDecoration).toBe("line-through");
      const read = readTextDecoration(written as TailwindStyles);
      expect(read).toBe("line-through");
    });

    it("should default to 'none' when no textDecoration set", () => {
      const read = readTextDecoration({} as TailwindStyles);
      expect(read).toBe("none");
    });
  });

  describe("writeTextTransform / readTextTransform", () => {
    it("should round-trip 'none' by clearing the field", () => {
      const written = writeTextTransform("none");
      expect(written.textTransform).toBeUndefined();
      const read = readTextTransform(written as TailwindStyles);
      expect(read).toBe("none");
    });

    it("should round-trip 'uppercase'", () => {
      const written = writeTextTransform("uppercase");
      expect(written.textTransform).toBe("uppercase");
      const read = readTextTransform(written as TailwindStyles);
      expect(read).toBe("uppercase");
    });

    it("should round-trip 'lowercase'", () => {
      const written = writeTextTransform("lowercase");
      expect(written.textTransform).toBe("lowercase");
      const read = readTextTransform(written as TailwindStyles);
      expect(read).toBe("lowercase");
    });

    it("should round-trip 'capitalize'", () => {
      const written = writeTextTransform("capitalize");
      expect(written.textTransform).toBe("capitalize");
      const read = readTextTransform(written as TailwindStyles);
      expect(read).toBe("capitalize");
    });

    it("should default to 'none' when no textTransform set", () => {
      const read = readTextTransform({} as TailwindStyles);
      expect(read).toBe("none");
    });
  });

  describe("writeTextWrap / readTextWrap", () => {
    it("should round-trip 'wrap' by clearing the field (default)", () => {
      const written = writeTextWrap("wrap");
      expect(written.textWrap).toBeUndefined();
      const read = readTextWrap(written as TailwindStyles);
      expect(read).toBe("wrap");
    });

    it("should round-trip 'nowrap'", () => {
      const written = writeTextWrap("nowrap");
      expect(written.textWrap).toBe("text-nowrap");
      const read = readTextWrap(written as TailwindStyles);
      expect(read).toBe("nowrap");
    });

    it("should round-trip 'balance'", () => {
      const written = writeTextWrap("balance");
      expect(written.textWrap).toBe("text-balance");
      const read = readTextWrap(written as TailwindStyles);
      expect(read).toBe("balance");
    });

    it("should round-trip 'pretty'", () => {
      const written = writeTextWrap("pretty");
      expect(written.textWrap).toBe("text-pretty");
      const read = readTextWrap(written as TailwindStyles);
      expect(read).toBe("pretty");
    });

    it("should default to 'wrap' when no textWrap set", () => {
      const read = readTextWrap({} as TailwindStyles);
      expect(read).toBe("wrap");
    });
  });

  describe("writeListStyleType / readListStyleType", () => {
    it("should round-trip 'none' by clearing both fields", () => {
      const written = writeListStyleType("none");
      expect(written.listStyleType).toBeUndefined();
      expect(written.display).toBeUndefined();
      const read = readListStyleType(written as TailwindStyles);
      expect(read).toBe("none");
    });

    it("should round-trip 'disc' and set display to list-item", () => {
      const written = writeListStyleType("disc");
      expect(written.listStyleType).toBe("list-disc");
      expect(written.display).toBe("list-item");
      const read = readListStyleType(written as TailwindStyles);
      expect(read).toBe("disc");
    });

    it("should round-trip 'decimal' and set display to list-item", () => {
      const written = writeListStyleType("decimal");
      expect(written.listStyleType).toBe("list-decimal");
      expect(written.display).toBe("list-item");
      const read = readListStyleType(written as TailwindStyles);
      expect(read).toBe("decimal");
    });

    it("should default to 'none' when no listStyleType set", () => {
      const read = readListStyleType({} as TailwindStyles);
      expect(read).toBe("none");
    });
  });

  describe("writeLineClamp / readLineClamp", () => {
    it("should round-trip undefined by clearing the field", () => {
      const written = writeLineClamp(undefined);
      expect(written.lineClamp).toBeUndefined();
      const read = readLineClamp(written as TailwindStyles);
      expect(read).toBeUndefined();
    });

    it("should round-trip a numeric value", () => {
      const written = writeLineClamp(3);
      expect(written.lineClamp).toBe("line-clamp-3");
      const read = readLineClamp(written as TailwindStyles);
      expect(read).toBe(3);
    });

    it("should read line-clamp-5 as 5", () => {
      const read = readLineClamp({ lineClamp: "line-clamp-5" } as TailwindStyles);
      expect(read).toBe(5);
    });

    it("should default to undefined when no lineClamp set", () => {
      const read = readLineClamp({} as TailwindStyles);
      expect(read).toBeUndefined();
    });
  });

  // ==========================================================================
  // BUG REPRODUCTIONS: Alignment grid issues
  // ==========================================================================

  describe("Bug: alignment mismatch in horizontal flow", () => {
    // In a flex-row container:
    //   justifyContent controls HORIZONTAL axis (left/center/right)
    //   alignItems controls VERTICAL axis (top/center/bottom)
    //
    // But readAlignment always maps justifyContent → row and alignItems → col,
    // which is only correct for flex-col.

    it("should read justify-start + items-center in flex-row as center-left (vertically centered, horizontally left)", () => {
      // flex-row: justify-start = left, items-center = vertically centered
      // Visual grid position should be: center-left (row=1 center, col=0 left)
      const styles = {
        flexDirection: "flex-row",
        justifyContent: "justify-start",
        alignItems: "items-center",
      } as TailwindStyles;
      const result = readAlignment(styles, "horizontal");
      // EXPECTED: "center-left" (vertically centered, horizontally left)
      expect(result).toBe("center-left");
    });

    it("should read justify-end + items-start in flex-row as top-right (top, right)", () => {
      // flex-row: justify-end = right, items-start = top
      // Visual grid position should be: top-right
      const styles = {
        flexDirection: "flex-row",
        justifyContent: "justify-end",
        alignItems: "items-start",
      } as TailwindStyles;
      const result = readAlignment(styles, "horizontal");
      expect(result).toBe("top-right");
    });

    it("should write top-right in flex-row as justify-end + items-start", () => {
      // Clicking top-right in a horizontal flow container should produce:
      // justify-end (right = horizontal main axis) + items-start (top = vertical cross axis)
      const result = writeAlignment("top-right", "horizontal");
      // EXPECTED for flex-row context
      expect(result.justifyContent).toBe("justify-end");
      expect(result.alignItems).toBe("items-start");
    });

    it("should round-trip center-right in flex-row correctly", () => {
      // center-right means: vertically centered, horizontally right
      // In flex-row: justify-end (right) + items-center (vertically centered)
      const styles = {
        flexDirection: "flex-row",
        justifyContent: "justify-end",
        alignItems: "items-center",
      } as TailwindStyles;
      const read = readAlignment(styles, "horizontal");
      expect(read).toBe("center-right");
    });
  });

  describe("Bug: space-between double-click overwrites justifyContent", () => {
    // FIX: AlignmentGridNew.handleDoubleClick no longer calls onChange()
    // when enabling space-between, so writeAlignment never clobbers justify-between.

    it("writeSpaceBetween(true) produces justify-between without conflict", () => {
      const sbUpdate = writeSpaceBetween(true);
      expect(sbUpdate.justifyContent).toBe("justify-between");
      // No writeAlignment call happens anymore when enabling space-between,
      // so the conflict is eliminated at the component level.
    });
  });

  describe("Bug: single-click in space-between mode clobbers justify-between", () => {
    // FIX: LayoutBridge.onAlignmentChange only applies alignItems (not justifyContent)
    // when space-between is active. writeAlignment still returns both properties,
    // but the bridge selectively applies only alignItems.

    it("writeAlignment returns both justifyContent and alignItems (bridge filters)", () => {
      const update = writeAlignment("center-left", "vertical");
      // writeAlignment always returns both — the LayoutBridge filters when space-between is active
      expect(update.justifyContent).toBeDefined();
      expect(update.alignItems).toBe("items-start");
    });
  });
});

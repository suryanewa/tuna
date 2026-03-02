import { describe, it, expect } from "vitest";
import {
  readGap, writeGap, readPaddingValues, writePadding, readMarginValues, writeMargin,
  readSize, writeWidth, writeHeight, readConstraint, writeConstraint,
  readRotation, writeRotation, readStickyValue, readFontSize, writeFontSize,
  readLineHeight, writeLineHeight, readLetterSpacing, writeLetterSpacing,
  readOpacity, writeOpacity, readCornerRadius, writeCornerRadius,
  readIndividualCornerRadius, writeIndividualCornerRadius,
  readBorder, writeBorder, readFilters, writeFilters,
  readSpaceBetween, writeSpaceBetween,
  readZIndex, writeZIndex,
  readFills,
  writeMinWidth, writeMinHeight, writeMaxWidth, writeMaxHeight,
} from "../tailwind-adapters";
import type { TailwindStyles } from "@/lib/playground/editor-types";

describe("Gap Adapter Edge Cases", () => {
  describe("BUG: readGap fails to parse arbitrary values produced by writeGap", () => {
    it("writeGap(15) produces gap-[15px], readGap should parse it back to 15", () => {
      const written = writeGap(15);
      expect(written.gap).toBe("gap-[15px]");
      const read = readGap({ gap: "gap-[15px]" } as TailwindStyles);
      expect(read).toBe(15);
    });
    it("writeGap(15) -> readGap round-trip should preserve value", () => {
      const read = readGap(writeGap(15) as TailwindStyles);
      expect(read).toBe(15);
    });
    it("writeGap(1) -> readGap round-trip (1px not a named unit)", () => {
      expect(writeGap(1).gap).toBe("gap-[1px]");
      expect(readGap(writeGap(1) as TailwindStyles)).toBe(1);
    });
    it("writeGap(3) -> readGap round-trip (3px not a named unit)", () => {
      expect(writeGap(3).gap).toBe("gap-[3px]");
      expect(readGap(writeGap(3) as TailwindStyles)).toBe(3);
    });
    it("writeGap(100) -> readGap round-trip (beyond named scale)", () => {
      expect(writeGap(100).gap).toBe("gap-[100px]");
      expect(readGap(writeGap(100) as TailwindStyles)).toBe(100);
    });
  });
  describe("Gap with special numeric values", () => {
    it("writeGap(NaN) should handle gracefully", () => {
      expect(writeGap(NaN).gap).toBeDefined();
    });
    it("writeGap(-5) should handle gracefully", () => {
      expect(writeGap(-5).gap).toBeDefined();
    });
  });
});

describe("Padding Adapter Edge Cases", () => {
  describe("BUG: readPaddingValues fails to parse arbitrary values from writePadding", () => {
    it("writePadding x=15 -> readPaddingValues round-trip", () => {
      const written = writePadding("x", 15, "xy");
      expect(written.paddingX).toBe("px-[15px]");
      expect(readPaddingValues(written as TailwindStyles).paddingX).toBe(15);
    });
    it("writePadding y=7 -> readPaddingValues round-trip", () => {
      expect(writePadding("y", 7, "xy").paddingY).toBe("py-[7px]");
      expect(readPaddingValues(writePadding("y", 7, "xy") as TailwindStyles).paddingY).toBe(7);
    });
    it("writePadding top=100 -> readPaddingValues round-trip", () => {
      expect(writePadding("top", 100, "individual").paddingTop).toBe("pt-[100px]");
      expect(readPaddingValues(writePadding("top", 100, "individual") as TailwindStyles).paddingTop).toBe(100);
    });
    it("writePadding right=33 -> readPaddingValues round-trip", () => {
      expect(writePadding("right", 33, "individual").paddingRight).toBe("pr-[33px]");
      expect(readPaddingValues(writePadding("right", 33, "individual") as TailwindStyles).paddingRight).toBe(33);
    });
    it("writePadding bottom=50 -> readPaddingValues round-trip", () => {
      expect(writePadding("bottom", 50, "individual").paddingBottom).toBe("pb-[50px]");
      expect(readPaddingValues(writePadding("bottom", 50, "individual") as TailwindStyles).paddingBottom).toBe(50);
    });
    it("writePadding left=25 -> readPaddingValues round-trip", () => {
      expect(writePadding("left", 25, "individual").paddingLeft).toBe("pl-[25px]");
      expect(readPaddingValues(writePadding("left", 25, "individual") as TailwindStyles).paddingLeft).toBe(25);
    });
  });
});

describe("Margin Adapter Edge Cases", () => {
  describe("BUG: readMarginValues fails to parse arbitrary values from writeMargin", () => {
    it("writeMargin x=15 -> readMarginValues round-trip", () => {
      expect(writeMargin("x", 15, "xy").marginX).toBe("mx-[15px]");
      expect(readMarginValues(writeMargin("x", 15, "xy") as TailwindStyles).marginX).toBe(15);
    });
    it("writeMargin top=13 -> readMarginValues round-trip", () => {
      expect(writeMargin("top", 13, "individual").marginTop).toBe("mt-[13px]");
      expect(readMarginValues(writeMargin("top", 13, "individual") as TailwindStyles).marginTop).toBe(13);
    });
    it("writeMargin bottom=99 -> readMarginValues round-trip", () => {
      expect(writeMargin("bottom", 99, "individual").marginBottom).toBe("mb-[99px]");
      expect(readMarginValues(writeMargin("bottom", 99, "individual") as TailwindStyles).marginBottom).toBe(99);
    });
  });
});

describe("Constraint Adapter Edge Cases", () => {
  describe("BUG: readConstraint fails to parse arbitrary values from writeConstraint", () => {
    it("writeConstraint top=15 -> readConstraint round-trip", () => {
      expect(writeConstraint("top", 15).top).toBe("top-[15px]");
      expect(readConstraint(writeConstraint("top", 15) as TailwindStyles, "top")).toBe(15);
    });
    it("writeConstraint right=100 -> readConstraint round-trip", () => {
      expect(writeConstraint("right", 100).right).toBe("right-[100px]");
      expect(readConstraint(writeConstraint("right", 100) as TailwindStyles, "right")).toBe(100);
    });
    it("writeConstraint bottom=7 -> readConstraint round-trip", () => {
      expect(writeConstraint("bottom", 7).bottom).toBe("bottom-[7px]");
      expect(readConstraint(writeConstraint("bottom", 7) as TailwindStyles, "bottom")).toBe(7);
    });
    it("writeConstraint left=50 -> readConstraint round-trip", () => {
      expect(writeConstraint("left", 50).left).toBe("left-[50px]");
      expect(readConstraint(writeConstraint("left", 50) as TailwindStyles, "left")).toBe(50);
    });
  });
  describe("readStickyValue with arbitrary constraint", () => {
    it("should parse sticky value from arbitrary top-[15px]", () => {
      expect(readStickyValue({ top: "top-[15px]" } as TailwindStyles)).toBe(15);
    });
  });
});

describe("Size Adapter Edge Cases", () => {
  it("readSize with decimal pixel values like w-[12.5px]", () => {
    expect(readSize({ width: "w-[12.5px]" } as TailwindStyles).width).toBe("12.5");
  });
  it("writeSizeValue with negative numbers", () => {
    expect(writeWidth("-10").width).toBe("w-[-10px]");
  });
  it("writeSizeValue with decimal string round-trip", () => {
    expect(writeWidth("12.5").width).toBe("w-[12.5px]");
    expect(readSize(writeWidth("12.5") as TailwindStyles).width).toBe("12.5");
  });
  it("writeSizeValue with empty string", () => {
    expect(writeWidth("").width).toBeUndefined();
  });
  it("readSize defaults to auto for garbage width values", () => {
    expect(readSize({ width: "w-potato" } as TailwindStyles).width).toBe("auto");
  });
});

describe("Rotation Edge Cases", () => {
  it("writeRotation(-0) should behave correctly", () => {
    expect(writeRotation(-0).rotate).toBeUndefined();
    expect(readRotation({} as TailwindStyles)).toBe(0);
  });
  it("writeRotation(720) -> readRotation round-trip", () => {
    expect(writeRotation(720).rotate).toBe("rotate-[720deg]");
    expect(readRotation(writeRotation(720) as TailwindStyles)).toBe(720);
  });
  it("writeRotation(-360) -> readRotation round-trip", () => {
    expect(writeRotation(-360).rotate).toBe("-rotate-[360deg]");
    expect(readRotation(writeRotation(-360) as TailwindStyles)).toBe(-360);
  });
  it("readRotation with rotate-45", () => {
    expect(readRotation({ rotate: "rotate-45" } as TailwindStyles)).toBe(45);
  });
  it("readRotation with -rotate-90", () => {
    expect(readRotation({ rotate: "-rotate-90" } as TailwindStyles)).toBe(-90);
  });
  it("readRotation with rotate-0", () => {
    expect(readRotation({ rotate: "rotate-0" } as TailwindStyles)).toBe(0);
  });
  it("readRotation with fractional degree rotate-[37.5deg]", () => {
    expect(readRotation({ rotate: "rotate-[37.5deg]" } as TailwindStyles)).toBe(37.5);
  });

  // BUG: Line creation writes rotate-[-45deg] (negative inside brackets)
  // but readRotation only handles -rotate-[45deg] (negative as prefix)
  it("readRotation with negative angle inside brackets rotate-[-45deg]", () => {
    expect(readRotation({ rotate: "rotate-[-45deg]" } as TailwindStyles)).toBe(-45);
  });
  it("readRotation with rotate-[-33.2deg]", () => {
    expect(readRotation({ rotate: "rotate-[-33.2deg]" } as TailwindStyles)).toBe(-33.2);
  });
});

describe("Opacity Edge Cases", () => {
  it("readOpacity with opacity-[1] should be 100", () => {
    expect(readOpacity({ opacity: "opacity-[1]" } as TailwindStyles)).toBe(100);
  });
  it("readOpacity with opacity-[0.001] should be 0", () => {
    expect(readOpacity({ opacity: "opacity-[0.001]" } as TailwindStyles)).toBe(0);
  });
  it("writeOpacity(0.5) lossy round-trip", () => {
    expect(writeOpacity(0.5).opacity).toBe("opacity-[0.005]");
    expect(readOpacity(writeOpacity(0.5) as TailwindStyles)).toBe(1);
  });
  it("writeOpacity(1) single percent", () => {
    expect(writeOpacity(1).opacity).toBe("opacity-[0.01]");
    expect(readOpacity(writeOpacity(1) as TailwindStyles)).toBe(1);
  });
  it("writeOpacity(101) over 100 clears", () => {
    expect(writeOpacity(101).opacity).toBeUndefined();
  });
  it("writeOpacity(-10) negative opacity should clamp to 0", () => {
    expect(writeOpacity(-10).opacity).toBe("opacity-0");
  });
});

describe("Typography Edge Cases", () => {
  describe("readFontSize with arbitrary font size", () => {
    it("readFontSize with text-[22px]", () => {
      expect(readFontSize({ fontSize: "text-[22px]" } as TailwindStyles)).toBe("22");
    });
    it("writeFontSize 22 -> readFontSize round-trip", () => {
      expect(writeFontSize("22").fontSize).toBe("text-[22px]");
      expect(readFontSize(writeFontSize("22") as TailwindStyles)).toBe("22");
    });
    it("writeFontSize 13 -> readFontSize round-trip", () => {
      expect(writeFontSize("13").fontSize).toBe("text-[13px]");
      expect(readFontSize(writeFontSize("13") as TailwindStyles)).toBe("13");
    });
  });
  describe("readLineHeight with arbitrary line heights", () => {
    it("readLineHeight with leading-[24px]", () => {
      expect(readLineHeight({ lineHeight: "leading-[24px]" } as TailwindStyles)).toBe("24");
    });
    it("writeLineHeight 24 -> readLineHeight round-trip", () => {
      expect(writeLineHeight("24").lineHeight).toBe("leading-6");
      expect(readLineHeight(writeLineHeight("24") as TailwindStyles)).toBe("24");
    });
    it("writeLineHeight 22 -> readLineHeight lossless round-trip", () => {
      expect(writeLineHeight("22").lineHeight).toBe("leading-[22px]");
      expect(readLineHeight(writeLineHeight("22") as TailwindStyles)).toBe("22");
    });
  });
  describe("readLetterSpacing edge cases", () => {
    it("readLetterSpacing with tracking-[0em] should return 0%", () => {
      expect(readLetterSpacing({ letterSpacing: "tracking-[0em]" } as TailwindStyles)).toBe("0%");
    });
    it("writeLetterSpacing 0.1% -> readLetterSpacing round-trip", () => {
      expect(writeLetterSpacing("0.1%").letterSpacing).toBe("tracking-[0.001em]");
      expect(readLetterSpacing(writeLetterSpacing("0.1%") as TailwindStyles)).toBe("0.1%");
    });
    it("writeLetterSpacing NaN% should handle gracefully", () => {
      expect(writeLetterSpacing("NaN%").letterSpacing).toBeUndefined();
    });
  });
});

describe("Filter Edge Cases", () => {
  describe("readFilters with arbitrary blur values", () => {
    it("readFilters with blur-[5px] should parse arbitrary blur", () => {
      const items = readFilters({ blur: "blur-[5px]" } as TailwindStyles);
      expect(items).toHaveLength(1);
      expect(items[0].value).toBe("5");
    });
    it("writeFilters blur=5 -> readFilters round-trip", () => {
      const filter = { id: "f1", type: "blur" as const, value: "5", target: "layer" as const, visible: true };
      const written = writeFilters([filter]);
      expect(written.blur).toBe("blur-[5px]");
      const items = readFilters(written as TailwindStyles);
      expect(items).toHaveLength(1);
      expect(items[0].value).toBe("5");
    });
    it("readFilters with backdrop-blur-[10px] should parse arbitrary", () => {
      const items = readFilters({ backdropBlur: "backdrop-blur-[10px]" } as TailwindStyles);
      expect(items).toHaveLength(1);
      expect(items[0].value).toBe("10");
    });
    it("writeFilters backdrop blur=10 -> readFilters round-trip", () => {
      const filter = { id: "f1", type: "blur" as const, value: "10", target: "backdrop" as const, visible: true };
      const written = writeFilters([filter]);
      expect(written.backdropBlur).toBe("backdrop-blur-[10px]");
      const items = readFilters(written as TailwindStyles);
      expect(items).toHaveLength(1);
      expect(items[0].value).toBe("10");
    });
  });
  describe("Filters with non-standard values", () => {
    it("writeFilters brightness=137 round-trip works", () => {
      const filter = { id: "f1", type: "brightness" as const, value: "137", target: "layer" as const, visible: true };
      const written = writeFilters([filter]);
      expect(written.brightness).toBe("brightness-137");
      expect(readFilters(written as TailwindStyles)[0].value).toBe("137");
    });
  });
});

describe("Border Edge Cases", () => {
  describe("readBorder with arbitrary border width", () => {
    it("readBorder with border-[3px] should parse the width", () => {
      const read = readBorder({ borderWidth: "border-[3px]", borderColor: "border-black" } as TailwindStyles);
      expect(read).not.toBeNull();
      expect(read!.width).toBe(3);
    });
    it("writeBorder width:3 -> readBorder round-trip", () => {
      const border = { color: "#000", opacity: 100, width: 3, style: "solid" as const, side: "all" as const };
      const written = writeBorder(border);
      expect(written.borderWidth).toBe("border-[3px]");
      const read = readBorder(written as TailwindStyles);
      expect(read).not.toBeNull();
      expect(read!.width).toBe(3);
    });
    it("writeBorder width:5 -> readBorder round-trip", () => {
      const border = { color: "#000", opacity: 100, width: 5, style: "solid" as const, side: "all" as const };
      expect(writeBorder(border).borderWidth).toBe("border-[5px]");
      expect(readBorder(writeBorder(border) as TailwindStyles)!.width).toBe(5);
    });
    it("writeBorder per-side with arbitrary width", () => {
      const border = { color: "#000", opacity: 100, width: 3, style: "solid" as const, side: "top" as const };
      expect(writeBorder(border).borderWidthTop).toBe("border-t-[3px]");
    });
  });
  describe("readBorder with mixed per-side borders", () => {
    it("readBorder when both top and bottom borders are set", () => {
      const read = readBorder({
        borderWidth: "border", borderColor: "border-black",
        borderWidthTop: "border-t-2", borderWidthBottom: "border-b-2",
      } as TailwindStyles);
      expect(read).not.toBeNull();
      expect(read!.side).toBe("all");
    });
  });
});

describe("Corner Radius Edge Cases", () => {
  describe("readCornerRadius with arbitrary values", () => {
    it("readCornerRadius with rounded-[10px] should parse arbitrary", () => {
      expect(readCornerRadius({ borderRadius: "rounded-[10px]" } as TailwindStyles)).toBe("10");
    });
    it("writeCornerRadius 10 -> readCornerRadius round-trip", () => {
      expect(writeCornerRadius("10").borderRadius).toBe("rounded-[10px]");
      expect(readCornerRadius(writeCornerRadius("10") as TailwindStyles)).toBe("10");
    });
    it("writeCornerRadius 100 -> readCornerRadius round-trip", () => {
      expect(writeCornerRadius("100").borderRadius).toBe("rounded-[100px]");
      expect(readCornerRadius(writeCornerRadius("100") as TailwindStyles)).toBe("100");
    });
  });
  describe("readIndividualCornerRadius with arbitrary values", () => {
    it("readIndividualCornerRadius with rounded-tl-[10px]", () => {
      expect(readIndividualCornerRadius(
        { borderRadiusTopLeft: "rounded-tl-[10px]" } as unknown as TailwindStyles, "TopLeft"
      )).toBe("10");
    });
    it("writeIndividualCornerRadius TopLeft 10 -> round-trip", () => {
      const written = writeIndividualCornerRadius("TopLeft", "10");
      expect(written.borderRadiusTopLeft).toBe("rounded-tl-[10px]");
      expect(readIndividualCornerRadius(written as unknown as TailwindStyles, "TopLeft")).toBe("10");
    });
    it("writeIndividualCornerRadius BottomRight 20 -> round-trip", () => {
      const written = writeIndividualCornerRadius("BottomRight", "20");
      expect(written.borderRadiusBottomRight).toBe("rounded-br-[20px]");
      expect(readIndividualCornerRadius(written as unknown as TailwindStyles, "BottomRight")).toBe("20");
    });
  });
});

describe("Compound Stress Tests", () => {
  it("full layout with all arbitrary spacing values", () => {
    const styles = { ...writeGap(15), ...writePadding("x", 25, "xy"), ...writePadding("y", 35, "xy") } as TailwindStyles;
    expect(readGap(styles)).toBe(15);
    expect(readPaddingValues(styles).paddingX).toBe(25);
    expect(readPaddingValues(styles).paddingY).toBe(35);
  });
  it("full position with all arbitrary constraint values", () => {
    const styles = {
      ...writeConstraint("top", 10), ...writeConstraint("right", 20),
      ...writeConstraint("bottom", 30), ...writeConstraint("left", 40),
    } as TailwindStyles;
    expect(readConstraint(styles, "top")).toBe(10);
    expect(readConstraint(styles, "right")).toBe(20);
    expect(readConstraint(styles, "bottom")).toBe(30);
    expect(readConstraint(styles, "left")).toBe(40);
  });
});

describe("Additional Edge Cases", () => {
  it("readSize with w-screen should return viewport", () => {
    expect(readSize({ width: "w-screen" } as TailwindStyles).width).toBe("viewport");
  });
  it("readSize with w-1/2 should not map to 2px", () => {
    expect(readSize({ width: "w-1/2" } as TailwindStyles).width).not.toBe("2");
  });
  it("writeGap(0) -> readGap round-trip", () => {
    expect(writeGap(0).gap).toBe("gap-0");
    expect(readGap(writeGap(0) as TailwindStyles)).toBe(0);
  });
  it("writeFontSize with NaN string", () => {
    expect(writeFontSize("potato").fontSize).toBe("text-[NaNpx]");
  });
});

// ============================================================================
// BUG 5: Individual corners not initialized from shared corner radius value
// When a container has rounded-[15px] (shared radius = 15), expanding to
// individual corners should show "15" for all 4 corners, not "0".
// ============================================================================

describe("Bug 5: Individual corners should fall back to shared corner radius", () => {
  it("readIndividualCornerRadius should return shared value when no individual corner is set", () => {
    // Element has borderRadius: "rounded-[15px]" but no individual corner classes
    const styles = { borderRadius: "rounded-[15px]" } as TailwindStyles;
    expect(readIndividualCornerRadius(styles, "TopLeft")).toBe("15");
    expect(readIndividualCornerRadius(styles, "TopRight")).toBe("15");
    expect(readIndividualCornerRadius(styles, "BottomLeft")).toBe("15");
    expect(readIndividualCornerRadius(styles, "BottomRight")).toBe("15");
  });

  it("readIndividualCornerRadius should return shared named radius value when no individual corner is set", () => {
    // Element has borderRadius: "rounded-lg" (8px) but no individual corner classes
    const styles = { borderRadius: "rounded-lg" } as TailwindStyles;
    expect(readIndividualCornerRadius(styles, "TopLeft")).toBe("8");
    expect(readIndividualCornerRadius(styles, "TopRight")).toBe("8");
    expect(readIndividualCornerRadius(styles, "BottomLeft")).toBe("8");
    expect(readIndividualCornerRadius(styles, "BottomRight")).toBe("8");
  });

  it("readIndividualCornerRadius should return shared rounded-full value when no individual corner is set", () => {
    const styles = { borderRadius: "rounded-full" } as TailwindStyles;
    expect(readIndividualCornerRadius(styles, "TopLeft")).toBe("9999");
    expect(readIndividualCornerRadius(styles, "TopRight")).toBe("9999");
    expect(readIndividualCornerRadius(styles, "BottomLeft")).toBe("9999");
    expect(readIndividualCornerRadius(styles, "BottomRight")).toBe("9999");
  });

  it("readIndividualCornerRadius should prefer individual value over shared when both exist", () => {
    // Individual corner is explicitly set, should use that instead of shared
    const styles = {
      borderRadius: "rounded-[15px]",
      borderRadiusTopLeft: "rounded-tl-[10px]",
    } as unknown as TailwindStyles;
    expect(readIndividualCornerRadius(styles, "TopLeft")).toBe("10");
    // Other corners should still fall back to shared value
    expect(readIndividualCornerRadius(styles, "TopRight")).toBe("15");
    expect(readIndividualCornerRadius(styles, "BottomLeft")).toBe("15");
    expect(readIndividualCornerRadius(styles, "BottomRight")).toBe("15");
  });

  it("readIndividualCornerRadius should return 0 when neither individual nor shared is set", () => {
    const styles = {} as TailwindStyles;
    expect(readIndividualCornerRadius(styles, "TopLeft")).toBe("0");
    expect(readIndividualCornerRadius(styles, "TopRight")).toBe("0");
  });
});

// ============================================================================
// BUG 18: readSize should report min/max values so SizeBridge can auto-show rows
// The readSize function already returns minWidth/minHeight/maxWidth/maxHeight,
// so these tests verify the values are correctly readable, which the SizeBridge
// can then use to decide whether to auto-show min/max rows.
// ============================================================================

describe("Bug 18: readSize should return min/max values for auto-show initialization", () => {
  it("readSize returns minWidth when min-w-[100px] is set", () => {
    const styles = { minWidth: "min-w-[100px]" } as TailwindStyles;
    const size = readSize(styles);
    expect(size.minWidth).toBe("100");
  });

  it("readSize returns minHeight when min-h-[50px] is set", () => {
    const styles = { minHeight: "min-h-[50px]" } as TailwindStyles;
    const size = readSize(styles);
    expect(size.minHeight).toBe("50");
  });

  it("readSize returns maxWidth when max-w-[400px] is set", () => {
    const styles = { maxWidth: "max-w-[400px]" } as TailwindStyles;
    const size = readSize(styles);
    expect(size.maxWidth).toBe("400");
  });

  it("readSize returns maxHeight when max-h-[600px] is set", () => {
    const styles = { maxHeight: "max-h-[600px]" } as TailwindStyles;
    const size = readSize(styles);
    expect(size.maxHeight).toBe("600");
  });

  it("readSize returns undefined for min/max when not set", () => {
    const styles = {} as TailwindStyles;
    const size = readSize(styles);
    expect(size.minWidth).toBeUndefined();
    expect(size.minHeight).toBeUndefined();
    expect(size.maxWidth).toBeUndefined();
    expect(size.maxHeight).toBeUndefined();
  });

  it("SizeBridge should auto-show min row: hasMinSize should be true when minWidth is set", () => {
    // This simulates the logic SizeBridge should use to initialize showMinSize
    const styles = { minWidth: "min-w-[100px]" } as TailwindStyles;
    const size = readSize(styles);
    const hasMinSize = !!(size.minWidth || size.minHeight);
    expect(hasMinSize).toBe(true);
  });

  it("SizeBridge should auto-show max row: hasMaxSize should be true when maxWidth is set", () => {
    // This simulates the logic SizeBridge should use to initialize showMaxSize
    const styles = { maxWidth: "max-w-[400px]" } as TailwindStyles;
    const size = readSize(styles);
    const hasMaxSize = !!(size.maxWidth || size.maxHeight);
    expect(hasMaxSize).toBe(true);
  });

  it("SizeBridge should not auto-show rows when no min/max values", () => {
    const styles = {} as TailwindStyles;
    const size = readSize(styles);
    const hasMinSize = !!(size.minWidth || size.minHeight);
    const hasMaxSize = !!(size.maxWidth || size.maxHeight);
    expect(hasMinSize).toBe(false);
    expect(hasMaxSize).toBe(false);
  });
});

// ============================================================================
// BUG 13: writeSpaceBetween(false) doesn't clear justifyContent
// ============================================================================

describe("Bug 13: writeSpaceBetween(false) should clear justifyContent", () => {
  it("writeSpaceBetween(false) should return justifyContent to clear it", () => {
    const written = writeSpaceBetween(false);
    // Must include justifyContent key so it actually clears the property
    expect(written).toHaveProperty("justifyContent");
  });

  it("writeSpaceBetween(false) should set justifyContent to falsy value to reset", () => {
    const written = writeSpaceBetween(false);
    // justifyContent must be present and falsy (undefined or "") to clear it
    expect("justifyContent" in written).toBe(true);
    expect(written.justifyContent).toBeFalsy();
  });

  it("toggling space-between on then off should clear justifyContent", () => {
    // Turn on space-between
    const on = writeSpaceBetween(true);
    expect(on.justifyContent).toBe("justify-between");

    // Turn off space-between -- should reset justifyContent
    const off = writeSpaceBetween(false);
    expect("justifyContent" in off).toBe(true);

    // Merge styles like the editor does: spread the "off" result over the "on" result
    const merged = { ...on, ...off } as TailwindStyles;
    expect(readSpaceBetween(merged)).toBe(false);
    // justifyContent should actually be cleared, not still "justify-between"
    expect(merged.justifyContent).not.toBe("justify-between");
  });
});

// ============================================================================
// BUG 15: readZIndex doesn't handle negative z-index
// ============================================================================

describe("Bug 15: readZIndex should handle negative z-index values", () => {
  it("readZIndex should parse -z-10 as '-10' (negative standard)", () => {
    expect(readZIndex({ zIndex: "-z-10" } as TailwindStyles)).toBe("-10");
  });

  it("readZIndex should parse -z-20 as '-20'", () => {
    expect(readZIndex({ zIndex: "-z-20" } as TailwindStyles)).toBe("-20");
  });

  it("readZIndex should parse -z-50 as '-50'", () => {
    expect(readZIndex({ zIndex: "-z-50" } as TailwindStyles)).toBe("-50");
  });

  it("readZIndex should parse z-[-5] as '-5' (arbitrary negative)", () => {
    expect(readZIndex({ zIndex: "z-[-5]" } as TailwindStyles)).toBe("-5");
  });

  it("readZIndex should parse z-[100] as '100' (arbitrary positive)", () => {
    expect(readZIndex({ zIndex: "z-[100]" } as TailwindStyles)).toBe("100");
  });

  it("readZIndex should still handle z-auto", () => {
    expect(readZIndex({ zIndex: "z-auto" } as TailwindStyles)).toBe("auto");
  });

  it("readZIndex should still handle z-10 (positive)", () => {
    expect(readZIndex({ zIndex: "z-10" } as TailwindStyles)).toBe("10");
  });

  it("readZIndex should still handle z-0", () => {
    expect(readZIndex({ zIndex: "z-0" } as TailwindStyles)).toBe("0");
  });
});

// ============================================================================
// BUG 16: writeOpacity doesn't clamp negative values
// ============================================================================

describe("Bug 16: writeOpacity should clamp out-of-range values", () => {
  it("writeOpacity(-50) should clamp to 0", () => {
    const written = writeOpacity(-50);
    // Should produce opacity-0, not some invalid negative class
    expect(written.opacity).toBe("opacity-0");
  });

  it("writeOpacity(-1) should clamp to 0", () => {
    const written = writeOpacity(-1);
    expect(written.opacity).toBe("opacity-0");
  });

  it("writeOpacity(150) should clamp to 100 (cleared)", () => {
    const written = writeOpacity(150);
    // 100% opacity clears the field
    expect(written.opacity).toBeUndefined();
  });

  it("writeOpacity(200) should clamp to 100 (cleared)", () => {
    const written = writeOpacity(200);
    expect(written.opacity).toBeUndefined();
  });

  it("writeOpacity(0) should still produce opacity-0 (no clamping needed)", () => {
    const written = writeOpacity(0);
    expect(written.opacity).toBe("opacity-0");
  });

  it("writeOpacity(50) should still work normally", () => {
    const written = writeOpacity(50);
    expect(written.opacity).toBe("opacity-50");
  });
});

// ============================================================================
// BUG 17: fillIdCounter grows unboundedly
// ============================================================================

describe("Bug 17: readFills should produce stable IDs (not growing counter)", () => {
  it("readFills called multiple times should not produce ever-increasing IDs", () => {
    const styles = { backgroundColor: "bg-red-500" } as TailwindStyles;

    const first = readFills(styles);
    const second = readFills(styles);
    const third = readFills(styles);

    // All calls with the same input should produce the same IDs
    expect(first[0].id).toBe(second[0].id);
    expect(second[0].id).toBe(third[0].id);
  });

  it("readFills IDs should be stable across 100 calls", () => {
    const styles = { backgroundColor: "bg-blue-500" } as TailwindStyles;

    const results = Array.from({ length: 100 }, () => readFills(styles));
    const firstId = results[0][0].id;

    for (let i = 1; i < results.length; i++) {
      expect(results[i][0].id).toBe(firstId);
    }
  });

  it("readFills should not contain ever-incrementing numeric suffixes", () => {
    const styles = { backgroundColor: "bg-green-500" } as TailwindStyles;

    // Call many times
    for (let i = 0; i < 50; i++) {
      readFills(styles);
    }

    const result = readFills(styles);
    const id = result[0].id;

    // The ID should not contain a large number (e.g., fill-151)
    // A reasonable ID would be something like "fill-1" or "fill-0" or deterministic
    const numericPart = id.match(/(\d+)$/);
    if (numericPart) {
      expect(parseInt(numericPart[1])).toBeLessThan(10);
    }
  });
});

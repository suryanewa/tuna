import { describe, it, expect } from "vitest";
import {
  readSize,
  writeWidth,
  writeHeight,
  writeMinWidth,
  writeMinHeight,
  writeMaxWidth,
  writeMaxHeight,
} from "../tailwind-adapters";
import type { TailwindStyles } from "@/lib/playground/editor-types";

/**
 * Bug: Circle shape set to 56x56 renders at ~300x300 in the editor.
 *
 * Root cause:
 * `writeSizeValue("56", "w-")` looks up PX_TO_SPACING[56] → "14" → returns "w-14".
 * Named Tailwind classes like "w-14" are NOT available in JIT-compiled CSS because
 * they are generated dynamically at runtime from element data, not found in source
 * code by the Tailwind scanner.
 *
 * The editor uses `extractArbitraryStyles()` to convert arbitrary Tailwind values
 * like `w-[56px]` to inline CSS `{ width: '56px' }`. But named classes like `w-14`
 * bypass this extraction, leaving the element without any width/height CSS.
 *
 * Fix: `writeSizeValue` must ALWAYS produce arbitrary pixel values (e.g. `w-[56px]`)
 * for numeric inputs, never named spacing classes. This ensures they go through
 * the extractArbitraryStyles → inline style pipeline.
 *
 * Affected pixel values (those in PX_TO_SPACING table):
 * 0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 80, 96
 */

describe("size adapter named class bug", () => {
  // These are all non-zero pixel values that currently map to named Tailwind classes.
  // 0 is excluded because w-0 = 0px always (0rem = 0px regardless of font size).
  const AFFECTED_VALUES = [
    { px: "2", namedClass: "w-0.5" },
    { px: "4", namedClass: "w-1" },
    { px: "6", namedClass: "w-1.5" },
    { px: "8", namedClass: "w-2" },
    { px: "10", namedClass: "w-2.5" },
    { px: "12", namedClass: "w-3" },
    { px: "14", namedClass: "w-3.5" },
    { px: "16", namedClass: "w-4" },
    { px: "20", namedClass: "w-5" },
    { px: "24", namedClass: "w-6" },
    { px: "28", namedClass: "w-7" },
    { px: "32", namedClass: "w-8" },
    { px: "36", namedClass: "w-9" },
    { px: "40", namedClass: "w-10" },
    { px: "44", namedClass: "w-11" },
    { px: "48", namedClass: "w-12" },
    { px: "56", namedClass: "w-14" },
    { px: "64", namedClass: "w-16" },
    { px: "80", namedClass: "w-20" },
    { px: "96", namedClass: "w-24" },
  ];

  describe("writeWidth must use arbitrary pixel values for all numeric sizes", () => {
    it("56px must produce w-[56px], not w-14", () => {
      const result = writeWidth("56");
      expect(result.width).toBe("w-[56px]");
    });

    it("all formerly-named values produce arbitrary pixel classes", () => {
      for (const { px, namedClass } of AFFECTED_VALUES) {
        const result = writeWidth(px);
        expect(result.width).toBe(`w-[${px}px]`);
        expect(result.width).not.toBe(namedClass);
      }
    });

    it("non-table values still use arbitrary format", () => {
      expect(writeWidth("55")).toEqual({ width: "w-[55px]" });
      expect(writeWidth("100")).toEqual({ width: "w-[100px]" });
      expect(writeWidth("250")).toEqual({ width: "w-[250px]" });
    });
  });

  describe("writeHeight must use arbitrary pixel values for all numeric sizes", () => {
    it("56px must produce h-[56px], not h-14", () => {
      const result = writeHeight("56");
      expect(result.height).toBe("h-[56px]");
    });

    it("all formerly-named values produce arbitrary pixel classes", () => {
      for (const { px } of AFFECTED_VALUES) {
        const result = writeHeight(px);
        expect(result.height).toBe(`h-[${px}px]`);
      }
    });
  });

  describe("min/max size must also use arbitrary pixel values", () => {
    it("writeMinWidth uses arbitrary format", () => {
      expect(writeMinWidth("56")).toEqual({ minWidth: "min-w-[56px]" });
    });
    it("writeMinHeight uses arbitrary format", () => {
      expect(writeMinHeight("56")).toEqual({ minHeight: "min-h-[56px]" });
    });
    it("writeMaxWidth uses arbitrary format", () => {
      expect(writeMaxWidth("56")).toEqual({ maxWidth: "max-w-[56px]" });
    });
    it("writeMaxHeight uses arbitrary format", () => {
      expect(writeMaxHeight("56")).toEqual({ maxHeight: "max-h-[56px]" });
    });
  });

  describe("special size keywords still work", () => {
    it("fill → w-full", () => {
      expect(writeWidth("fill")).toEqual({ width: "w-full" });
    });
    it("auto → w-auto", () => {
      expect(writeWidth("auto")).toEqual({ width: "w-auto" });
    });
    it("hug → w-fit", () => {
      expect(writeWidth("hug")).toEqual({ width: "w-fit" });
    });
  });

  describe("readSize round-trip: write then read back", () => {
    it("arbitrary value round-trips correctly", () => {
      const written = writeWidth("56");
      const styles = { width: written.width } as TailwindStyles;
      const read = readSize(styles);
      expect(read.width).toBe("56");
    });

    it("all pixel values round-trip correctly", () => {
      for (const { px } of AFFECTED_VALUES) {
        const written = writeWidth(px);
        const styles = { width: written.width } as TailwindStyles;
        const read = readSize(styles);
        expect(read.width).toBe(px);
      }
    });

    it("keywords round-trip correctly", () => {
      for (const keyword of ["fill", "auto", "hug"]) {
        const written = writeWidth(keyword);
        const styles = { width: written.width } as TailwindStyles;
        const read = readSize(styles);
        expect(read.width).toBe(keyword);
      }
    });
  });

  describe("readSize handles legacy named classes (backward compat)", () => {
    it("reads w-14 as 56 for existing elements", () => {
      const styles = { width: "w-14" } as TailwindStyles;
      const read = readSize(styles);
      expect(read.width).toBe("56");
    });

    it("reads h-14 as 56 for existing elements", () => {
      const styles = { height: "h-14" } as TailwindStyles;
      const read = readSize(styles);
      expect(read.height).toBe("56");
    });
  });

  describe("0px special case", () => {
    it("0 can stay as w-0 (0rem = 0px always, no conversion issue)", () => {
      const result = writeWidth("0");
      // w-0 is safe because 0rem === 0px regardless of font size
      expect(result.width).toBe("w-0");
    });
  });
});

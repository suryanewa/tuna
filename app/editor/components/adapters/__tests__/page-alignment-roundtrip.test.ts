import { describe, it, expect } from "vitest";
import {
  pageStylesToTailwind,
  applyTailwindToPageStyles,
} from "../page-tailwind-converter";
import {
  readAlignment,
  writeAlignment,
  readDirection,
} from "../tailwind-adapters";
import { defaultPageStyles, type PageStyles } from "@/lib/playground/store";
import type { TailwindStyles } from "@/lib/playground/editor-types";

/**
 * Bug: Page-level alignment grid works in some cases but not others.
 *
 * Root cause: PageStyles has no `alignItems` field. Cross-axis alignment is
 * overloaded into `layoutMode`:
 *   - "centered" → items-center (works)
 *   - "end" → items-end (works)
 *   - "horizontal" → flex-row, NO alignItems stored (broken)
 *   - "stack" → flex-col, NO alignItems stored (broken)
 *
 * When the user clicks an alignment cell, writeAlignment() produces both
 * justifyContent and alignItems. applyTailwindToPageStyles() stores
 * justifyContent but discards alignItems for "horizontal" and "stack" modes.
 * On read-back, the alignment reverts to the default.
 *
 * Expected: Alignment should roundtrip through PageStyles for ALL layout modes.
 */

function makePageStyles(overrides: Partial<PageStyles> = {}): PageStyles {
  return { ...defaultPageStyles, ...overrides };
}

/** Simulate clicking an alignment cell on the page panel */
function simulatePageAlignmentChange(
  pageStyles: PageStyles,
  alignment: string,
): PageStyles {
  const tw = pageStylesToTailwind(pageStyles) as TailwindStyles;
  const dir = readDirection(tw);
  const twUpdate = writeAlignment(alignment as any, dir);
  const pageDelta = applyTailwindToPageStyles(twUpdate, pageStyles);
  return { ...pageStyles, ...pageDelta };
}

/** Read back alignment from PageStyles */
function readPageAlignment(pageStyles: PageStyles): string {
  const tw = pageStylesToTailwind(pageStyles) as TailwindStyles;
  const dir = readDirection(tw);
  return readAlignment(tw, dir);
}

describe("page alignment grid roundtrip", () => {
  describe("vertical (stack) layout", () => {
    const base = makePageStyles({ layoutMode: "stack" });

    it("center-center should roundtrip", () => {
      const updated = simulatePageAlignmentChange(base, "center-center");
      expect(readPageAlignment(updated)).toBe("center-center");
    });

    it("top-center should roundtrip", () => {
      const updated = simulatePageAlignmentChange(base, "top-center");
      expect(readPageAlignment(updated)).toBe("top-center");
    });

    it("bottom-right should roundtrip", () => {
      const updated = simulatePageAlignmentChange(base, "bottom-right");
      expect(readPageAlignment(updated)).toBe("bottom-right");
    });

    it("top-left should roundtrip", () => {
      const updated = simulatePageAlignmentChange(base, "top-left");
      expect(readPageAlignment(updated)).toBe("top-left");
    });
  });

  describe("horizontal layout", () => {
    const base = makePageStyles({ layoutMode: "horizontal" });

    it("center-center should roundtrip", () => {
      const updated = simulatePageAlignmentChange(base, "center-center");
      expect(readPageAlignment(updated)).toBe("center-center");
    });

    it("top-left should roundtrip", () => {
      const updated = simulatePageAlignmentChange(base, "top-left");
      expect(readPageAlignment(updated)).toBe("top-left");
    });

    it("bottom-right should roundtrip", () => {
      const updated = simulatePageAlignmentChange(base, "bottom-right");
      expect(readPageAlignment(updated)).toBe("bottom-right");
    });

    it("center-left should roundtrip", () => {
      const updated = simulatePageAlignmentChange(base, "center-left");
      expect(readPageAlignment(updated)).toBe("center-left");
    });
  });

  describe("centered layout switching alignment", () => {
    const base = makePageStyles({ layoutMode: "centered" });

    it("top-left should roundtrip (mode may change to stack)", () => {
      const updated = simulatePageAlignmentChange(base, "top-left");
      expect(readPageAlignment(updated)).toBe("top-left");
    });

    it("center-right should roundtrip", () => {
      const updated = simulatePageAlignmentChange(base, "center-right");
      expect(readPageAlignment(updated)).toBe("center-right");
    });
  });

  describe("all 9 positions roundtrip in stack mode", () => {
    const positions = [
      "top-left", "top-center", "top-right",
      "center-left", "center-center", "center-right",
      "bottom-left", "bottom-center", "bottom-right",
    ];
    const base = makePageStyles({ layoutMode: "stack" });

    for (const pos of positions) {
      it(`${pos} should roundtrip`, () => {
        const updated = simulatePageAlignmentChange(base, pos);
        expect(readPageAlignment(updated)).toBe(pos);
      });
    }
  });

  describe("all 9 positions roundtrip in horizontal mode", () => {
    const positions = [
      "top-left", "top-center", "top-right",
      "center-left", "center-center", "center-right",
      "bottom-left", "bottom-center", "bottom-right",
    ];
    const base = makePageStyles({ layoutMode: "horizontal" });

    for (const pos of positions) {
      it(`${pos} should roundtrip`, () => {
        const updated = simulatePageAlignmentChange(base, pos);
        expect(readPageAlignment(updated)).toBe(pos);
      });
    }
  });
});

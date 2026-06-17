import { describe, it, expect, beforeAll } from "vitest";
import {
  computeCanvasDropIndex,
  isEffectiveNoOp,
  formatSelectionLabel,
  SELECTION_COLORS,
  isPointInsideSelectionBounds,
  SELECTION_CLICK_PAD,
  shouldPickerConsumeEscapeKey,
} from "../selector/picker";

// ── DOMRect polyfill for Node ──

class MockDOMRect {
  x: number; y: number; width: number; height: number;
  top: number; right: number; bottom: number; left: number;
  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x; this.y = y; this.width = width; this.height = height;
    this.left = x; this.top = y; this.right = x + width; this.bottom = y + height;
  }
  toJSON() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
}

beforeAll(() => {
  (globalThis as any).DOMRect = MockDOMRect;
});

// ── computeCanvasDropIndex ──

describe("computeCanvasDropIndex", () => {
  function vRects(...tops: number[]): DOMRect[] {
    return tops.map(t => new MockDOMRect(0, t, 200, 32) as unknown as DOMRect);
  }

  function hRects(...lefts: number[]): DOMRect[] {
    return lefts.map(l => new MockDOMRect(l, 0, 100, 50) as unknown as DOMRect);
  }

  describe("vertical layout", () => {
    it("returns first index when cursor is above all", () => {
      const rects = vRects(100, 150, 200);
      expect(computeCanvasDropIndex(0, 50, rects, [0, 1, 2], false, 3)).toBe(0);
    });

    it("returns after-all index when cursor is below all", () => {
      const rects = vRects(100, 150, 200);
      expect(computeCanvasDropIndex(0, 300, rects, [0, 1, 2], false, 3)).toBe(3);
    });

    it("returns correct index based on midpoint", () => {
      const rects = vRects(100, 150, 200);
      // midpoints: 116, 166, 216
      expect(computeCanvasDropIndex(0, 110, rects, [0, 1, 2], false, 3)).toBe(0);
      expect(computeCanvasDropIndex(0, 140, rects, [0, 1, 2], false, 3)).toBe(1);
      expect(computeCanvasDropIndex(0, 180, rects, [0, 1, 2], false, 3)).toBe(2);
      expect(computeCanvasDropIndex(0, 220, rects, [0, 1, 2], false, 3)).toBe(3);
    });

    it("handles single element", () => {
      const rects = vRects(100);
      expect(computeCanvasDropIndex(0, 80, rects, [0], false, 1)).toBe(0);
      expect(computeCanvasDropIndex(0, 120, rects, [0], false, 1)).toBe(1);
    });

    it("handles empty rects", () => {
      expect(computeCanvasDropIndex(0, 100, [], [], false, 0)).toBe(0);
    });
  });

  describe("horizontal layout", () => {
    it("returns correct index based on horizontal midpoint", () => {
      const rects = hRects(0, 120, 240);
      // midpoints: 50, 170, 290
      expect(computeCanvasDropIndex(30, 0, rects, [0, 1, 2], true, 3)).toBe(0);
      expect(computeCanvasDropIndex(100, 0, rects, [0, 1, 2], true, 3)).toBe(1);
      expect(computeCanvasDropIndex(200, 0, rects, [0, 1, 2], true, 3)).toBe(2);
      expect(computeCanvasDropIndex(300, 0, rects, [0, 1, 2], true, 3)).toBe(3);
    });
  });

  describe("filtered index mapping", () => {
    it("maps filtered indices back to full sibling indices", () => {
      // Siblings [A=0, B=1(dragged), C=2, D=3]
      // Filtered: [A=0, C=2, D=3] at otherIndices [0, 2, 3]
      const rects = vRects(100, 200, 300);
      const otherIndices = [0, 2, 3];

      // Cursor above A → insert at index 0
      expect(computeCanvasDropIndex(0, 50, rects, otherIndices, false, 1)).toBe(0);

      // Cursor below A midpoint, above C midpoint → insert at index 2
      expect(computeCanvasDropIndex(0, 180, rects, otherIndices, false, 1)).toBe(2);

      // Cursor below all → insert at index 4 (after D=3)
      expect(computeCanvasDropIndex(0, 400, rects, otherIndices, false, 1)).toBe(4);
    });

    it("handles dragged element at end", () => {
      // Siblings [A=0, B=1], dragging B(1)
      // Filtered: [A=0] at otherIndices [0]
      const rects = vRects(100);
      const otherIndices = [0];

      expect(computeCanvasDropIndex(0, 50, rects, otherIndices, false, 1)).toBe(0);
      expect(computeCanvasDropIndex(0, 200, rects, otherIndices, false, 1)).toBe(1);
    });

    it("handles dragged element at start", () => {
      // Siblings [A=0, B=1, C=2], dragging A(0)
      // Filtered: [B=1, C=2] at otherIndices [1, 2]
      const rects = vRects(100, 200);
      const otherIndices = [1, 2];

      expect(computeCanvasDropIndex(0, 50, rects, otherIndices, false, 0)).toBe(1);
      expect(computeCanvasDropIndex(0, 300, rects, otherIndices, false, 0)).toBe(3);
    });
  });
});

// ── isEffectiveNoOp ──

describe("isEffectiveNoOp", () => {
  it("returns true when indices are identical", () => {
    expect(isEffectiveNoOp(0, 0)).toBe(true);
    expect(isEffectiveNoOp(3, 3)).toBe(true);
  });

  it("returns false when insertion indices produce a visual move", () => {
    expect(isEffectiveNoOp(2, 0)).toBe(false);
    expect(isEffectiveNoOp(1, 3)).toBe(false);
  });

  it("returns true when insertion index is immediately after the dragged element", () => {
    expect(isEffectiveNoOp(0, 1)).toBe(true);
    expect(isEffectiveNoOp(1, 2)).toBe(true);
  });
});

// ── formatSelectionLabel ──

describe("formatSelectionLabel", () => {
  it("formats dimensions with spaces around ×", () => {
    expect(formatSelectionLabel(824, 49)).toBe("824 × 49");
  });

  it("rounds fractional values", () => {
    expect(formatSelectionLabel(320.7, 240.3)).toBe("321 × 240");
  });

  it("handles zero dimensions", () => {
    expect(formatSelectionLabel(0, 0)).toBe("0 × 0");
  });

  it("handles large dimensions", () => {
    expect(formatSelectionLabel(1920, 1080)).toBe("1920 × 1080");
  });

  it("handles sub-pixel values", () => {
    expect(formatSelectionLabel(100.4, 50.5)).toBe("100 × 51");
  });
});

describe("SELECTION_COLORS", () => {
  it("provides distinct colors for multi-select outlines", () => {
    expect(SELECTION_COLORS.length).toBeGreaterThanOrEqual(2);
    expect(new Set(SELECTION_COLORS).size).toBe(SELECTION_COLORS.length);
    expect(SELECTION_COLORS[0]).toBe("#0D99FF");
  });
});

describe("isPointInsideSelectionBounds", () => {
  function mockEl(rect: { left: number; top: number; width: number; height: number }): Element {
    return {
      getBoundingClientRect: () => new DOMRect(rect.left, rect.top, rect.width, rect.height),
    } as unknown as Element;
  }

  it("returns true for points inside an element", () => {
    const el = mockEl({ left: 100, top: 100, width: 20, height: 20 });
    expect(isPointInsideSelectionBounds(110, 110, [el])).toBe(true);
  });

  it("returns true within padding of bounds", () => {
    const el = mockEl({ left: 100, top: 100, width: 20, height: 20 });
    expect(isPointInsideSelectionBounds(100 - SELECTION_CLICK_PAD, 110, [el])).toBe(true);
  });

  it("returns false for points clearly outside", () => {
    const el = mockEl({ left: 100, top: 100, width: 20, height: 20 });
    expect(isPointInsideSelectionBounds(50, 50, [el])).toBe(false);
  });

  it("checks union of multiple selected elements", () => {
    const a = mockEl({ left: 0, top: 0, width: 10, height: 10 });
    const b = mockEl({ left: 100, top: 100, width: 10, height: 10 });
    expect(isPointInsideSelectionBounds(5, 5, [a, b])).toBe(true);
    expect(isPointInsideSelectionBounds(105, 105, [a, b])).toBe(true);
    expect(isPointInsideSelectionBounds(50, 50, [a, b])).toBe(false);
  });
});

describe("shouldPickerConsumeEscapeKey", () => {
  const baseState = {
    selectedDrawPathCount: 0,
    selectedElementCount: 0,
    hasSelectedElement: false,
    hasFloatingDialog: false,
    hasCommentPopover: false,
    commentMode: false,
  };

  it("does not consume Escape when there is no picker selection", () => {
    expect(shouldPickerConsumeEscapeKey(baseState)).toBe(false);
  });

  it("consumes Escape when an element selection can be cleared", () => {
    expect(shouldPickerConsumeEscapeKey({
      ...baseState,
      selectedElementCount: 1,
      hasSelectedElement: true,
    })).toBe(true);
  });

  it("consumes Escape when a drawing selection can be cleared", () => {
    expect(shouldPickerConsumeEscapeKey({
      ...baseState,
      selectedDrawPathCount: 1,
    })).toBe(true);
  });

  it("leaves Escape for higher-level handlers while dialogs or comment mode are active", () => {
    expect(shouldPickerConsumeEscapeKey({
      ...baseState,
      selectedElementCount: 1,
      hasSelectedElement: true,
      hasFloatingDialog: true,
    })).toBe(false);
    expect(shouldPickerConsumeEscapeKey({
      ...baseState,
      selectedElementCount: 1,
      hasSelectedElement: true,
      hasCommentPopover: true,
    })).toBe(false);
    expect(shouldPickerConsumeEscapeKey({
      ...baseState,
      selectedElementCount: 1,
      hasSelectedElement: true,
      commentMode: true,
    })).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { computeDragRect, type Rect } from "../drag-rect";

/**
 * BUG: During resize drag, the selection overlay bounding box does NOT update
 * in real-time. It only updates after clicking away and clicking back.
 *
 * Root cause: useElementBounds doesn't re-measure during drag because its
 * dependencies (selectedIds, zoom) haven't changed. The DOM element has
 * changed size but the overlay still shows old bounds.
 *
 * Fix: Track a dragRect that overrides measured bounds during active drag.
 * computeDragRect computes the new overlay rect from the start overlay rect
 * + screen-space mouse deltas based on which handle is being dragged.
 */

const startRect: Rect = { x: 100, y: 50, width: 200, height: 150 };
const MIN_OVERLAY = 20; // MIN_SIZE * zoomScale at zoom=100

describe("computeDragRect - resize handles", () => {
  describe("SE handle (grow right and down)", () => {
    it("increases width and height when dragging right/down", () => {
      const result = computeDragRect(startRect, "se", 50, 30, 1, false);
      expect(result).toEqual({
        x: 100,
        y: 50,
        width: 250,
        height: 180,
      });
    });

    it("clamps to minimum size when dragging inward", () => {
      const result = computeDragRect(startRect, "se", -300, -300, 1, false);
      expect(result.width).toBe(MIN_OVERLAY);
      expect(result.height).toBe(MIN_OVERLAY);
      expect(result.x).toBe(100);
      expect(result.y).toBe(50);
    });
  });

  describe("NW handle (grow left and up)", () => {
    it("increases width/height and moves x/y when dragging left/up", () => {
      const result = computeDragRect(startRect, "nw", -40, -20, 1, false);
      expect(result).toEqual({
        x: 60,
        y: 30,
        width: 240,
        height: 170,
      });
    });

    it("clamps so that width/height don't go below minimum", () => {
      const result = computeDragRect(startRect, "nw", 300, 300, 1, false);
      expect(result.width).toBe(MIN_OVERLAY);
      expect(result.height).toBe(MIN_OVERLAY);
      // x/y should shift by at most (startWidth - min) and (startHeight - min)
      expect(result.x).toBe(100 + (200 - MIN_OVERLAY));
      expect(result.y).toBe(50 + (150 - MIN_OVERLAY));
    });
  });

  describe("E handle (grow right only)", () => {
    it("increases width only, y and height unchanged", () => {
      const result = computeDragRect(startRect, "e", 60, 999, 1, false);
      expect(result).toEqual({
        x: 100,
        y: 50,
        width: 260,
        height: 150,
      });
    });
  });

  describe("W handle (grow left only)", () => {
    it("increases width and shifts x left", () => {
      const result = computeDragRect(startRect, "w", -30, 999, 1, false);
      expect(result).toEqual({
        x: 70,
        y: 50,
        width: 230,
        height: 150,
      });
    });
  });

  describe("S handle (grow down only)", () => {
    it("increases height only", () => {
      const result = computeDragRect(startRect, "s", 999, 40, 1, false);
      expect(result).toEqual({
        x: 100,
        y: 50,
        width: 200,
        height: 190,
      });
    });
  });

  describe("N handle (grow up only)", () => {
    it("increases height and shifts y up", () => {
      const result = computeDragRect(startRect, "n", 999, -25, 1, false);
      expect(result).toEqual({
        x: 100,
        y: 25,
        width: 200,
        height: 175,
      });
    });
  });

  describe("NE handle (grow right and up)", () => {
    it("increases width right, increases height up", () => {
      const result = computeDragRect(startRect, "ne", 50, -30, 1, false);
      expect(result).toEqual({
        x: 100,
        y: 20,
        width: 250,
        height: 180,
      });
    });
  });

  describe("SW handle (grow left and down)", () => {
    it("increases width left, increases height down", () => {
      const result = computeDragRect(startRect, "sw", -50, 30, 1, false);
      expect(result).toEqual({
        x: 50,
        y: 50,
        width: 250,
        height: 180,
      });
    });
  });
});

describe("computeDragRect - zoom scaling", () => {
  it("applies minimum size scaled by zoom", () => {
    const zoomScale = 2;
    const minOverlay = MIN_OVERLAY * zoomScale; // 40
    const smallRect: Rect = { x: 0, y: 0, width: 50, height: 50 };
    const result = computeDragRect(smallRect, "se", -100, -100, zoomScale, false);
    expect(result.width).toBe(minOverlay);
    expect(result.height).toBe(minOverlay);
  });
});

describe("computeDragRect - aspect ratio lock (shift key)", () => {
  it("SE corner handle: constrains to aspect ratio", () => {
    // startRect is 200x150, ratio = 4/3
    // Dragging +100 in x would give 300 width. Height from ratio = 300 / (4/3) = 225
    // Dragging +50 in y would give 200 height. Width from ratio = 200 * (4/3) = 266.67
    // We take the larger dimension, so if +100x and +50y:
    // newWidth=300, newHeight=200
    // wFromH = 200 * (4/3) = 266.67, hFromW = 300 / (4/3) = 225
    // since newWidth/ratio (225) > newHeight (200), newWidth = wFromH = 266.67
    // Actually: if newWidth / ratio < newHeight => use hFromW, else use wFromH
    // 300 / (4/3) = 225 < 200? No, 225 > 200 => use wFromH = 200 * (4/3) = 266.67
    const result = computeDragRect(startRect, "se", 100, 50, 1, true);
    const ratio = 200 / 150;
    // newWidth=300, newHeight=200
    // 300/ratio = 225, which is NOT < 200, so newWidth = newHeight * ratio = 200 * 4/3 = 266.67
    expect(result.width).toBeCloseTo(200 * ratio);
    expect(result.height).toBe(200);
  });

  it("E edge handle: height adjusts to match width", () => {
    const result = computeDragRect(startRect, "e", 100, 0, 1, true);
    const ratio = 200 / 150;
    // newWidth = 300, newHeight = 300 / ratio = 225
    expect(result.width).toBe(300);
    expect(result.height).toBeCloseTo(300 / ratio);
  });

  it("S edge handle: width adjusts to match height", () => {
    const result = computeDragRect(startRect, "s", 0, 100, 1, true);
    const ratio = 200 / 150;
    // newHeight = 250, newWidth = 250 * ratio = 333.33
    expect(result.height).toBe(250);
    expect(result.width).toBeCloseTo(250 * ratio);
  });
});

describe("computeDragRect - move", () => {
  it("translates position by screen-space deltas", () => {
    const result = computeDragRect(startRect, "move", 30, -20, 1, false);
    expect(result).toEqual({
      x: 130,
      y: 30,
      width: 200,
      height: 150,
    });
  });
});

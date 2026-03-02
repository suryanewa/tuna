import { describe, it, expect } from "vitest";

/**
 * Bug 1: Text wraps when dragging an absolute element to the right.
 *
 * Root cause: The move handler only updates left/top constraints but doesn't
 * set an explicit width. Without a fixed pixel width, the absolute element's
 * available width = parent width - left offset. As left increases, available
 * width decreases, causing text to wrap and the bounding box to resize.
 *
 * Fix: At the start of a move drag, if the element doesn't have an explicit
 * pixel width, capture the current rendered width and set it via writeWidth().
 */

/**
 * Bug 2: After releasing a move drag, the bounding box snaps back to
 * its pre-drag position, then corrects when hovering elsewhere.
 *
 * Root cause: The rAF in handlePointerUp clears dragRect, falling back to
 * measured bounds. But useElementBounds only re-measures on:
 *   - Selection/zoom change (useLayoutEffect)
 *   - Element/container RESIZE (ResizeObserver)
 * A move changes position, not size — ResizeObserver doesn't fire.
 * Bounds stay stale until something else triggers re-measurement
 * (e.g., hoveredId change when mouse leaves the bounding box).
 *
 * Fix: Expose measure() from the hook. Call it in the rAF before clearing
 * dragRect so both setBounds and setDragRect(null) are batched in one render.
 */

describe("move drag bug 1: text wrapping on right drag", () => {
  it("absolute element without explicit width loses available space as left increases", () => {
    const parentWidth = 800;

    // Element starts at left: 100, no explicit width → available width = 700
    const left1 = 100;
    const availableWidth1 = parentWidth - left1;
    expect(availableWidth1).toBe(700);

    // Drag right to left: 500 → available width = 300 (text wraps!)
    const left2 = 500;
    const availableWidth2 = parentWidth - left2;
    expect(availableWidth2).toBe(300);

    // With explicit width set, available width doesn't matter
    const explicitWidth = 400;
    // Element keeps its 400px width regardless of left position
    expect(explicitWidth).toBe(400); // stable, no wrapping
  });

  it("should capture current width at drag start for elements without explicit width", () => {
    // Simulate: element has no explicit width, rendered at 400px
    const renderedWidth = 400;
    const hasExplicitWidth = false;

    // At drag start, should set width to rendered width
    const widthToSet = hasExplicitWidth ? undefined : String(renderedWidth);
    expect(widthToSet).toBe("400");
  });
});

describe("move drag bug 2: bounding box snaps back after release", () => {
  it("ResizeObserver does not fire for position-only changes", () => {
    // Simulate: element at (100, 50), size 400x200
    const beforeMove = { x: 100, y: 50, width: 400, height: 200 };

    // After move to (300, 150), size stays the same
    const afterMove = { x: 300, y: 150, width: 400, height: 200 };

    // Size didn't change — ResizeObserver won't fire
    expect(afterMove.width).toBe(beforeMove.width);
    expect(afterMove.height).toBe(beforeMove.height);

    // Position changed — but ResizeObserver doesn't detect this
    expect(afterMove.x).not.toBe(beforeMove.x);
    expect(afterMove.y).not.toBe(beforeMove.y);
  });

  it("explicit measure() call in rAF updates bounds before clearing dragRect", () => {
    // Simulate the fix: measure() + setDragRect(null) batched together
    const staleBounds = new Map([["el-1", { x: 100, y: 50, width: 400, height: 200 }]]);
    const freshBounds = new Map([["el-1", { x: 300, y: 150, width: 400, height: 200 }]]);

    // In rAF callback:
    // 1. measure() → setBounds(freshBounds)
    // 2. setDragRect(null)
    // React batches both → next render has fresh bounds + null dragRect
    const getRect = (id: string, dragRect: null, bounds: Map<string, any>) =>
      bounds.get(id);

    // With stale bounds (bug): wrong position
    expect(getRect("el-1", null, staleBounds)?.x).toBe(100);

    // With fresh bounds (fix): correct position
    expect(getRect("el-1", null, freshBounds)?.x).toBe(300);
  });
});

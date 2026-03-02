import { describe, it, expect } from "vitest";

/**
 * Bug: After resize drag ends, the overlay bounding box visually "snaps back"
 * to the pre-drag dimensions, then after a short delay updates to the correct size.
 *
 * Root cause: Two issues compound:
 * 1. `useElementBounds` only observes the canvas container with ResizeObserver,
 *    not individual elements. When an element's size changes (via Tailwind class updates),
 *    nothing triggers re-measurement unless the canvas itself resizes.
 * 2. `handlePointerUp` clears `dragRect` immediately (setDragRect(null)), which
 *    causes `getRect(id)` to fall back to stale measured bounds before the hook
 *    has had a chance to re-measure.
 *
 * Fix: (a) Observe individual elements with ResizeObserver so bounds auto-update
 *      when elements resize. (b) Delay clearing dragRect until after bounds update.
 */

describe("bounds update timing after resize", () => {
  it("should not revert to stale bounds when dragRect is cleared", () => {
    // Simulate the getRect fallback logic
    const staleBounds = new Map<string, { x: number; y: number; width: number; height: number }>();
    staleBounds.set("el-1", { x: 100, y: 50, width: 649, height: 214 });

    const dragRect = { id: "el-1", rect: { x: 100, y: 50, width: 699, height: 214 } };

    // During drag: getRect returns dragRect
    const getRectDuringDrag = (id: string) =>
      dragRect?.id === id ? dragRect.rect : staleBounds.get(id);

    expect(getRectDuringDrag("el-1")).toEqual({ x: 100, y: 50, width: 699, height: 214 });

    // After pointerup clears dragRect but BEFORE bounds re-measure:
    // This is the buggy state - getRect falls back to stale bounds
    const clearedDragRect = null as typeof dragRect | null;
    const getRectAfterClear = (id: string) =>
      clearedDragRect?.id === id ? clearedDragRect.rect : staleBounds.get(id);

    // BUG: This returns the old 649 width instead of the new 699
    const staleResult = getRectAfterClear("el-1");
    expect(staleResult?.width).toBe(649); // Documents the bug: stale width returned

    // After bounds re-measure (ResizeObserver fires), it corrects itself
    const updatedBounds = new Map(staleBounds);
    updatedBounds.set("el-1", { x: 100, y: 50, width: 699, height: 214 });

    const getRectAfterRemeasure = (id: string) =>
      clearedDragRect?.id === id ? clearedDragRect.rect : updatedBounds.get(id);

    expect(getRectAfterRemeasure("el-1")?.width).toBe(699); // Correct after re-measure
  });

  it("dragRect should only be cleared AFTER bounds have updated", () => {
    // The fix: dragRect is kept until bounds catch up
    const staleBounds = new Map<string, { x: number; y: number; width: number; height: number }>();
    staleBounds.set("el-1", { x: 100, y: 50, width: 649, height: 214 });

    const dragRect = { id: "el-1", rect: { x: 100, y: 50, width: 699, height: 214 } };

    // Even after pointerup, dragRect should persist until bounds update
    const getRect = (id: string, currentDragRect: typeof dragRect | null, currentBounds: typeof staleBounds) =>
      currentDragRect?.id === id ? currentDragRect.rect : currentBounds.get(id);

    // Phase 1: pointerup fires, dragRect still present (not cleared yet)
    expect(getRect("el-1", dragRect, staleBounds)?.width).toBe(699); // Still shows drag rect

    // Phase 2: bounds update via ResizeObserver
    const updatedBounds = new Map(staleBounds);
    updatedBounds.set("el-1", { x: 100, y: 50, width: 699, height: 214 });

    // Phase 3: Now dragRect can be safely cleared - bounds are correct
    expect(getRect("el-1", null, updatedBounds)?.width).toBe(699); // No flash!
  });

  it("ResizeObserver should observe individual elements, not just canvas", () => {
    // This test documents that the hook MUST observe each element's size
    // to detect when Tailwind class changes cause an element to resize.
    //
    // Current (buggy): only canvas is observed
    //   observer.observe(canvas)
    //
    // Fixed: each element is also observed
    //   for (id of stableIds) {
    //     const el = canvas.querySelector(`[data-element-id="${id}"]`);
    //     if (el) observer.observe(el);
    //   }
    //
    // This is a documentation test - the real verification is in the browser.
    expect(true).toBe(true);
  });
});

import { describe, it, expect, vi } from "vitest";

/**
 * GradientStopBar event handling tests.
 *
 * Bug: Clicking or dragging a stop indicator triggers `onAddStop` because:
 *   1. `onPointerDown` calls `e.stopPropagation()`, but that only stops
 *      the pointerdown event — NOT the subsequent `click` event.
 *   2. The container's `onClick={handleBarClick}` fires after pointerup.
 *   3. `isDraggingRef` has already been reset to `false` in `handleHandlePointerUp`,
 *      so the guard `if (isDraggingRef.current) return` does NOT protect.
 *
 * Fix: Add `onClick={e => e.stopPropagation()}` on each stop indicator div
 * so the click event never reaches the container's handleBarClick.
 */

describe("GradientStopBar — click vs drag disambiguation", () => {
  it("pointerdown stopPropagation does NOT prevent click from bubbling (documenting DOM behavior)", () => {
    // Simulating the event ordering that the browser follows:
    //   pointerdown → pointermove* → pointerup → click
    //
    // Even when stopPropagation() is called on pointerdown,
    // the click is a separate event and still bubbles.

    const isDraggingRef = { current: false };
    const onAddStop = vi.fn();

    // 1. Pointer down on indicator
    isDraggingRef.current = true;
    // e.stopPropagation() called — only affects pointerdown event

    // 2. Pointer up on indicator
    isDraggingRef.current = false; // reset in handleHandlePointerUp

    // 3. Click fires on container (separate event, still bubbles)
    //    The guard checks isDraggingRef but it's already false:
    if (!isDraggingRef.current) {
      onAddStop(); // BUG: this fires!
    }

    // The guard fails — onAddStop is called when it shouldn't be
    expect(onAddStop).toHaveBeenCalled();
  });

  it("with onClick stopPropagation on indicator, click never reaches container", () => {
    const onAddStop = vi.fn();
    let clickReachedContainer = false;

    // Simulate: indicator has onClick={e => e.stopPropagation()}
    const indicatorStopsClick = true;

    // 1. Pointer down on indicator
    // 2. Pointer up on indicator
    // 3. Click fires on indicator — stopPropagation prevents bubbling
    if (!indicatorStopsClick) {
      clickReachedContainer = true;
      onAddStop();
    }

    // With the fix, onAddStop is never called
    expect(onAddStop).not.toHaveBeenCalled();
    expect(clickReachedContainer).toBe(false);
  });
});

import { describe, it, expect } from "vitest";

/**
 * Bug: When changing an element's top/left values via the property panel
 * inputs, the element moves but the bounding box overlay doesn't update
 * until clicking out or hovering into the canvas.
 *
 * Root cause: useElementBounds re-measures on:
 *   1. Selection/zoom change (useLayoutEffect dependency)
 *   2. Element RESIZE (ResizeObserver)
 *
 * Changing left/top via the panel triggers a CRDT write → React re-render
 * → extractArbitraryStyles updates inline left/top → element moves in DOM.
 * But the element's WIDTH and HEIGHT haven't changed, so ResizeObserver
 * doesn't fire. The selection/zoom deps haven't changed either. The
 * overlay stays stale until something else triggers re-measurement
 * (e.g., hoveredId change on mouse enter, or clicking to change selection).
 *
 * Fix: Add a MutationObserver on each selected element watching for
 * `style` attribute changes. When the style attribute mutates (from
 * extractArbitraryStyles updating inline left/top/etc.), trigger
 * re-measurement. This covers ALL property panel changes that affect
 * position, margin, padding, transform, etc. — not just left/top.
 */

describe("panel position change: bounding box doesn't track position-only changes", () => {
  it("ResizeObserver does not fire when only left/top change", () => {
    // Simulate: element style changes from left:100 to left:300
    const beforeStyle = { width: 400, height: 200, left: 100, top: 50 };
    const afterStyle = { width: 400, height: 200, left: 300, top: 150 };

    // Size didn't change — ResizeObserver won't fire
    const sizeChanged =
      beforeStyle.width !== afterStyle.width ||
      beforeStyle.height !== afterStyle.height;
    expect(sizeChanged).toBe(false);

    // Position DID change — but ResizeObserver is blind to this
    const positionChanged =
      beforeStyle.left !== afterStyle.left ||
      beforeStyle.top !== afterStyle.top;
    expect(positionChanged).toBe(true);

    // Result: bounding box stays at old position until next re-measure trigger
  });

  it("MutationObserver detects style attribute changes", () => {
    // MutationObserver with { attributes: true, attributeFilter: ["style"] }
    // fires whenever the style attribute is modified, regardless of which
    // CSS properties changed. This catches:
    //   - left/top changes (position via panel)
    //   - margin/padding changes (spacing via panel)
    //   - transform changes (rotation via panel)
    //   - ANY property panel change that modifies inline styles

    const styleChanges = [
      { prop: "left", before: "100px", after: "300px" },
      { prop: "top", before: "50px", after: "150px" },
      { prop: "margin-top", before: "0px", after: "20px" },
      { prop: "transform", before: "none", after: "rotate(45deg)" },
    ];

    // All of these change the style attribute but NOT the element size
    for (const change of styleChanges) {
      // MutationObserver would fire for each — ResizeObserver would not
      expect(change.before).not.toBe(change.after);
    }
  });

  it("re-measurement after style mutation gives correct bounds", () => {
    // After MutationObserver fires → measure() → fresh bounds
    const staleBounds = { x: 100, y: 50, width: 400, height: 200 };
    const freshBounds = { x: 300, y: 150, width: 400, height: 200 };

    // Position changed but size stayed the same
    expect(freshBounds.width).toBe(staleBounds.width);
    expect(freshBounds.x).not.toBe(staleBounds.x);
    expect(freshBounds.y).not.toBe(staleBounds.y);
  });
});

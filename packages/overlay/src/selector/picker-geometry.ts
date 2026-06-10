import { SELECTION_CLICK_PAD } from "./picker-constants";

/** True when (x, y) lies inside any selected element's bounds (plus pad). */
export function isPointInsideSelectionBounds(
  x: number,
  y: number,
  elements: Element[],
  pad = SELECTION_CLICK_PAD,
): boolean {
  for (const el of elements) {
    const r = el.getBoundingClientRect();
    if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) {
      return true;
    }
  }
  return false;
}

/**
 * Compute drop index using filtered rects (dragged element excluded).
 * Returns an index in the full siblings array.
 */
export function computeCanvasDropIndex(
  cursorX: number,
  cursorY: number,
  otherRects: DOMRect[],
  otherIndices: number[],
  horizontal: boolean,
  dragIndex: number,
): number {
  const cursor = horizontal ? cursorX : cursorY;
  let insertBefore = otherRects.length;

  for (let i = 0; i < otherRects.length; i += 1) {
    const mid = horizontal
      ? otherRects[i].left + otherRects[i].width / 2
      : otherRects[i].top + otherRects[i].height / 2;
    if (cursor < mid) {
      insertBefore = i;
      break;
    }
  }

  if (insertBefore >= otherIndices.length) {
    return otherIndices.length > 0 ? otherIndices[otherIndices.length - 1] + 1 : dragIndex;
  }
  return otherIndices[insertBefore];
}

/** Check if drop index is effectively the same position. */
export function isEffectiveNoOp(dragIndex: number, dropIndex: number): boolean {
  return dragIndex === dropIndex;
}

/** Format selection label as dimensions only. */
export function formatSelectionLabel(width: number, height: number): string {
  return `${Math.round(width)} × ${Math.round(height)}`;
}

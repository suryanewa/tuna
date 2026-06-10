export const SNAP_THRESHOLD = 5;

export type SnapCache = {
  siblingWidths: number[];
  siblingHeights: number[];
  siblingRects: DOMRect[];
  parentRect: DOMRect | null;
  parentWidth: number;
  parentHeight: number;
  parentPadding: { top: number; right: number; bottom: number; left: number };
  canFillWidth: boolean;
  canFillHeight: boolean;
};

export type SnapGuide = {
  axis: "x" | "y";
  value: number;
  ref: number;
  refRect?: DOMRect;
  fill?: boolean;
};

export type ResizeSnapResult = {
  width: number;
  height: number;
  guides: SnapGuide[];
  fillWidth: boolean;
  fillHeight: boolean;
};

export function findSnap(value: number, candidates: number[]): number | null {
  let lo = 0;
  let hi = candidates.length - 1;
  let best: number | null = null;
  let bestDist = SNAP_THRESHOLD + 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const dist = Math.abs(candidates[mid] - value);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidates[mid];
    }
    if (candidates[mid] < value) lo = mid + 1;
    else hi = mid - 1;
  }

  return bestDist <= SNAP_THRESHOLD ? best : null;
}

export function snapResize(
  cache: SnapCache | null,
  width: number,
  height: number,
  axes: { dx: number; dy: number },
): ResizeSnapResult {
  if (!cache) return { width, height, guides: [], fillWidth: false, fillHeight: false };

  const guides: SnapGuide[] = [];
  let nextWidth = width;
  let nextHeight = height;
  let fillWidth = false;
  let fillHeight = false;

  if (axes.dx !== 0) {
    const parentSnapWidth = cache.canFillWidth && Math.abs(nextWidth - cache.parentWidth) <= SNAP_THRESHOLD
      ? cache.parentWidth
      : null;
    if (parentSnapWidth !== null) {
      nextWidth = parentSnapWidth;
      fillWidth = true;
      guides.push({ axis: "x", value: parentSnapWidth, ref: parentSnapWidth, fill: true });
    } else {
      const snapWidth = findSnap(nextWidth, cache.siblingWidths);
      if (snapWidth !== null) {
        nextWidth = snapWidth;
        const matchRect = cache.siblingRects.find((rect) => Math.round(rect.width) === snapWidth);
        guides.push({ axis: "x", value: snapWidth, ref: snapWidth, refRect: matchRect });
      }
    }
  }

  if (axes.dy !== 0) {
    const parentSnapHeight = cache.canFillHeight && Math.abs(nextHeight - cache.parentHeight) <= SNAP_THRESHOLD
      ? cache.parentHeight
      : null;
    if (parentSnapHeight !== null) {
      nextHeight = parentSnapHeight;
      fillHeight = true;
      guides.push({ axis: "y", value: parentSnapHeight, ref: parentSnapHeight, fill: true });
    } else {
      const snapHeight = findSnap(nextHeight, cache.siblingHeights);
      if (snapHeight !== null) {
        nextHeight = snapHeight;
        const matchRect = cache.siblingRects.find((rect) => Math.round(rect.height) === snapHeight);
        guides.push({ axis: "y", value: snapHeight, ref: snapHeight, refRect: matchRect });
      }
    }
  }

  return { width: nextWidth, height: nextHeight, guides, fillWidth, fillHeight };
}

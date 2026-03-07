/**
 * BoxModelOverlay — renders colored overlays on the selected element
 * to visualize padding, margin, or gap when hovering the respective inputs.
 *
 * Supports individual sides (e.g. "paddingTop", "marginLeft") or
 * the whole group ("gap").
 *
 * - Padding: green semi-transparent areas inside the element
 * - Margin: orange semi-transparent areas outside the element
 * - Gap: purple/pink rectangles between flex/grid children
 */

import { useState, useLayoutEffect } from "react";

export type BoxModelProperty =
  | "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft"
  | "marginTop" | "marginRight" | "marginBottom" | "marginLeft"
  | "gap" | "columnGap" | "rowGap"
  | null;

interface BoxModelOverlayProps {
  element: Element;
  hoveredProperty: BoxModelProperty;
  /** Increment to force recompute (e.g. on property changes) */
  revision?: number;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING_COLOR = "rgba(77, 200, 96, 0.35)";
const MARGIN_COLOR = "rgba(246, 178, 107, 0.35)";
const GAP_COLOR = "rgba(195, 125, 255, 0.35)";

function computePaddingRect(
  side: "Top" | "Right" | "Bottom" | "Left",
  computed: CSSStyleDeclaration,
  elRect: DOMRect,
): Rect | null {
  const pt = parseFloat(computed.paddingTop) || 0;
  const pr = parseFloat(computed.paddingRight) || 0;
  const pb = parseFloat(computed.paddingBottom) || 0;
  const pl = parseFloat(computed.paddingLeft) || 0;

  switch (side) {
    case "Top":
      return pt > 0 ? { top: elRect.top, left: elRect.left, width: elRect.width, height: pt } : null;
    case "Bottom":
      return pb > 0 ? { top: elRect.bottom - pb, left: elRect.left, width: elRect.width, height: pb } : null;
    case "Left":
      return pl > 0 ? { top: elRect.top, left: elRect.left, width: pl, height: elRect.height } : null;
    case "Right":
      return pr > 0 ? { top: elRect.top, left: elRect.right - pr, width: pr, height: elRect.height } : null;
  }
}

function computeMarginRect(
  side: "Top" | "Right" | "Bottom" | "Left",
  computed: CSSStyleDeclaration,
  elRect: DOMRect,
): Rect | null {
  const mt = parseFloat(computed.marginTop) || 0;
  const mr = parseFloat(computed.marginRight) || 0;
  const mb = parseFloat(computed.marginBottom) || 0;
  const ml = parseFloat(computed.marginLeft) || 0;

  switch (side) {
    case "Top":
      return mt > 0 ? { top: elRect.top - mt, left: elRect.left - ml, width: elRect.width + ml + mr, height: mt } : null;
    case "Bottom":
      return mb > 0 ? { top: elRect.bottom, left: elRect.left - ml, width: elRect.width + ml + mr, height: mb } : null;
    case "Left":
      return ml > 0 ? { top: elRect.top, left: elRect.left - ml, width: ml, height: elRect.height } : null;
    case "Right":
      return mr > 0 ? { top: elRect.top, left: elRect.right, width: mr, height: elRect.height } : null;
  }
}

function computeGapRects(element: Element, computed: CSSStyleDeclaration): Rect[] {
  const newRects: Rect[] = [];
  const display = computed.display;
  const isFlex = display.includes("flex");
  const isGrid = display.includes("grid");

  if (!isFlex && !isGrid) return newRects;

  const children = Array.from(element.children).filter((child) => {
    const cs = getComputedStyle(child);
    return cs.position === "static" || cs.position === "relative";
  });

  if (children.length <= 1) return newRects;

  const parentRect = element.getBoundingClientRect();

  if (isFlex) {
    const isVertical = (computed.flexDirection || "row").startsWith("column");
    for (let i = 0; i < children.length - 1; i++) {
      const curr = children[i].getBoundingClientRect();
      const next = children[i + 1].getBoundingClientRect();

      if (isVertical) {
        const gapTop = curr.bottom;
        const gapBottom = next.top;
        if (gapBottom > gapTop + 0.5) {
          newRects.push({
            top: gapTop,
            left: parentRect.left,
            width: parentRect.width,
            height: gapBottom - gapTop,
          });
        }
      } else {
        const gapLeft = curr.right;
        const gapRight = next.left;
        if (gapRight > gapLeft + 0.5) {
          newRects.push({
            top: parentRect.top,
            left: gapLeft,
            width: gapRight - gapLeft,
            height: parentRect.height,
          });
        }
      }
    }
    return newRects;
  }

  // Grid: group by rows
  const sorted = [...children].sort((a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return ar.top - br.top || ar.left - br.left;
  });

  const rows: Element[][] = [];
  let currentRow: Element[] = [];
  let lastTop = -Infinity;

  for (const child of sorted) {
    const r = child.getBoundingClientRect();
    if (r.top > lastTop + 5) {
      if (currentRow.length > 0) rows.push(currentRow);
      currentRow = [child];
      lastTop = r.top;
    } else {
      currentRow.push(child);
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);

  // Column gaps within each row
  for (const row of rows) {
    for (let i = 0; i < row.length - 1; i++) {
      const curr = row[i].getBoundingClientRect();
      const next = row[i + 1].getBoundingClientRect();
      const gapLeft = curr.right;
      const gapRight = next.left;
      if (gapRight > gapLeft + 0.5) {
        newRects.push({
          top: parentRect.top,
          left: gapLeft,
          width: gapRight - gapLeft,
          height: parentRect.height,
        });
      }
    }
  }

  // Row gaps between rows
  for (let i = 0; i < rows.length - 1; i++) {
    const currRow = rows[i];
    const nextRow = rows[i + 1];
    const currBottom = Math.max(...currRow.map((c) => c.getBoundingClientRect().bottom));
    const nextTop = Math.min(...nextRow.map((c) => c.getBoundingClientRect().top));
    if (nextTop > currBottom + 0.5) {
      newRects.push({
        top: currBottom,
        left: parentRect.left,
        width: parentRect.width,
        height: nextTop - currBottom,
      });
    }
  }

  // Deduplicate
  return newRects.filter((r, i) => {
    for (let j = 0; j < i; j++) {
      const o = newRects[j];
      if (
        Math.abs(r.top - o.top) < 1 &&
        Math.abs(r.left - o.left) < 1 &&
        Math.abs(r.width - o.width) < 1 &&
        Math.abs(r.height - o.height) < 1
      ) return false;
    }
    return true;
  });
}

export function BoxModelOverlay({ element, hoveredProperty, revision }: BoxModelOverlayProps) {
  const [rects, setRects] = useState<Rect[]>([]);
  const [color, setColor] = useState(PADDING_COLOR);

  useLayoutEffect(() => {
    if (!hoveredProperty || !element) {
      setRects([]);
      return;
    }

    const computed = getComputedStyle(element);
    const elRect = element.getBoundingClientRect();

    if (hoveredProperty.startsWith("padding")) {
      const side = hoveredProperty.replace("padding", "") as "Top" | "Right" | "Bottom" | "Left";
      const rect = computePaddingRect(side, computed, elRect);
      setRects(rect ? [rect] : []);
      setColor(PADDING_COLOR);
    } else if (hoveredProperty.startsWith("margin")) {
      const side = hoveredProperty.replace("margin", "") as "Top" | "Right" | "Bottom" | "Left";
      const rect = computeMarginRect(side, computed, elRect);
      setRects(rect ? [rect] : []);
      setColor(MARGIN_COLOR);
    } else {
      // gap, columnGap, rowGap
      const allGaps = computeGapRects(element, computed);

      if (hoveredProperty === "gap") {
        setRects(allGaps);
      } else if (hoveredProperty === "columnGap") {
        // Filter to horizontal gaps only (wider than tall, roughly)
        const isVerticalLayout = (computed.flexDirection || "row").startsWith("column");
        setRects(isVerticalLayout
          ? allGaps.filter((r) => r.width >= r.height)
          : allGaps.filter((r) => r.height >= r.width),
        );
      } else {
        // rowGap — opposite
        const isVerticalLayout = (computed.flexDirection || "row").startsWith("column");
        setRects(isVerticalLayout
          ? allGaps.filter((r) => r.height >= r.width)
          : allGaps.filter((r) => r.width >= r.height),
        );
      }
      setColor(GAP_COLOR);
    }
  }, [element, hoveredProperty, revision]);

  if (rects.length === 0) return null;

  return (
    <>
      {rects.map((r, i) => (
        <div
          key={i}
          className="composer-box-model-rect"
          style={{
            position: "fixed",
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
            backgroundColor: color,
            pointerEvents: "none",
            zIndex: 2147483645,
          }}
        />
      ))}
    </>
  );
}

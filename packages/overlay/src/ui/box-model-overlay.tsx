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

import { useMemo } from "react";

export type BoxModelProperty =
  | "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft"
  | "paddingBlock" | "paddingInline"
  | "marginTop" | "marginRight" | "marginBottom" | "marginLeft"
  | "marginBlock" | "marginInline"
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

function diagonalPattern(r: number, g: number, b: number) {
  const line = `rgba(${r}, ${g}, ${b}, 0.5)`;
  return `repeating-linear-gradient(-45deg, transparent, transparent 3px, ${line} 3px, ${line} 4px)`;
}

const PADDING_COLOR = diagonalPattern(13, 153, 255);
const MARGIN_COLOR = diagonalPattern(255, 168, 36);
const GAP_COLOR = diagonalPattern(255, 77, 157);

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
      const currCS = getComputedStyle(children[i]);
      const nextCS = getComputedStyle(children[i + 1]);

      if (isVertical) {
        // Subtract margins to isolate the actual gap
        const currMarginBottom = parseFloat(currCS.marginBottom) || 0;
        const nextMarginTop = parseFloat(nextCS.marginTop) || 0;
        const gapTop = curr.bottom + currMarginBottom;
        const gapBottom = next.top - nextMarginTop;
        if (gapBottom > gapTop + 0.5) {
          newRects.push({
            top: gapTop,
            left: parentRect.left,
            width: parentRect.width,
            height: gapBottom - gapTop,
          });
        }
      } else {
        const currMarginRight = parseFloat(currCS.marginRight) || 0;
        const nextMarginLeft = parseFloat(nextCS.marginLeft) || 0;
        const gapLeft = curr.right + currMarginRight;
        const gapRight = next.left - nextMarginLeft;
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

  // Column gaps within each row (subtract horizontal margins)
  for (const row of rows) {
    for (let i = 0; i < row.length - 1; i++) {
      const curr = row[i].getBoundingClientRect();
      const next = row[i + 1].getBoundingClientRect();
      const currMR = parseFloat(getComputedStyle(row[i]).marginRight) || 0;
      const nextML = parseFloat(getComputedStyle(row[i + 1]).marginLeft) || 0;
      const gapLeft = curr.right + currMR;
      const gapRight = next.left - nextML;
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

  // Row gaps between rows (subtract vertical margins)
  for (let i = 0; i < rows.length - 1; i++) {
    const currRow = rows[i];
    const nextRow = rows[i + 1];
    const currBottom = Math.max(...currRow.map((c) => {
      const r = c.getBoundingClientRect();
      return r.bottom + (parseFloat(getComputedStyle(c).marginBottom) || 0);
    }));
    const nextTop = Math.min(...nextRow.map((c) => {
      const r = c.getBoundingClientRect();
      return r.top - (parseFloat(getComputedStyle(c).marginTop) || 0);
    }));
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
  const { rects, color } = useMemo(() => {
    if (!hoveredProperty || !element) {
      return { rects: [] as Rect[], color: PADDING_COLOR };
    }

    const computed = getComputedStyle(element);
    const elRect = element.getBoundingClientRect();

    if (hoveredProperty === "paddingBlock" || hoveredProperty === "paddingInline") {
      const sides: ("Top" | "Right" | "Bottom" | "Left")[] =
        hoveredProperty === "paddingBlock" ? ["Top", "Bottom"] : ["Left", "Right"];
      const rects = sides.map(s => computePaddingRect(s, computed, elRect)).filter(Boolean) as Rect[];
      return { rects, color: PADDING_COLOR };
    } else if (hoveredProperty === "marginBlock" || hoveredProperty === "marginInline") {
      const sides: ("Top" | "Right" | "Bottom" | "Left")[] =
        hoveredProperty === "marginBlock" ? ["Top", "Bottom"] : ["Left", "Right"];
      const rects = sides.map(s => computeMarginRect(s, computed, elRect)).filter(Boolean) as Rect[];
      return { rects, color: MARGIN_COLOR };
    } else if (hoveredProperty.startsWith("padding")) {
      const side = hoveredProperty.replace("padding", "") as "Top" | "Right" | "Bottom" | "Left";
      const rect = computePaddingRect(side, computed, elRect);
      return { rects: rect ? [rect] : [], color: PADDING_COLOR };
    } else if (hoveredProperty.startsWith("margin")) {
      const side = hoveredProperty.replace("margin", "") as "Top" | "Right" | "Bottom" | "Left";
      const rect = computeMarginRect(side, computed, elRect);
      return { rects: rect ? [rect] : [], color: MARGIN_COLOR };
    } else {
      // gap, columnGap, rowGap
      const allGaps = computeGapRects(element, computed);
      let filteredRects: Rect[];

      if (hoveredProperty === "gap") {
        filteredRects = allGaps;
      } else if (hoveredProperty === "columnGap") {
        // Filter to horizontal gaps only (wider than tall, roughly)
        const isVerticalLayout = (computed.flexDirection || "row").startsWith("column");
        filteredRects = isVerticalLayout
          ? allGaps.filter((r) => r.width >= r.height)
          : allGaps.filter((r) => r.height >= r.width);
      } else {
        // rowGap — opposite
        const isVerticalLayout = (computed.flexDirection || "row").startsWith("column");
        filteredRects = isVerticalLayout
          ? allGaps.filter((r) => r.height >= r.width)
          : allGaps.filter((r) => r.width >= r.height);
      }
      return { rects: filteredRects, color: GAP_COLOR };
    }
  }, [element, hoveredProperty, revision]);

  if (rects.length === 0) return null;

  return (
    <>
      {rects.map((r, i) => (
        <div
          key={i}
          className="tuna-box-model-rect"
          style={{
            position: "fixed",
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
            background: color,
            pointerEvents: "none",
            zIndex: 2147483645,
          }}
        />
      ))}
    </>
  );
}

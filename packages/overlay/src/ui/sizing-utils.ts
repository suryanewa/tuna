/**
 * Centralized sizing-mode logic.
 *
 * Given an axis (width/height), a target mode (fill/hug/fixed), and context
 * about the element's layout position, returns a map of CSS properties that
 * must be set. The caller iterates and applies them — no branching needed.
 */

export interface SizingContext {
  isFlexChild: boolean;
  isGridChild: boolean;
  parentFlexDir: string; // "row" | "column" | "row-reverse" | "column-reverse"
  currentStyles: Record<string, string>;
  elementRect?: { width: number; height: number };
}

export type SizingMode = "fill" | "hug" | "fixed";

/**
 * Returns a map of CSS properties to set for the given sizing mode change.
 *
 * Key rules per layout context:
 *
 * Block / non-flex, non-grid:
 *   fill  → { [axis]: "100%" }
 *   hug   → { [axis]: "fit-content" }
 *   fixed → { [axis]: "<px>" }
 *
 * Grid child:
 *   fill  → { [axis]: "auto", justifySelf|alignSelf: "stretch" }
 *   hug   → { [axis]: "fit-content" } + reset justify/alignSelf if stretch/auto/normal
 *   fixed → { [axis]: "<px>" }
 *
 * Flex child — main axis:
 *   fill  → { flexGrow: 1, flexShrink: 1, flexBasis: 0px, [axis]: auto }
 *   hug   → { flexGrow: 0, flexShrink: 0, flexBasis: auto, [axis]: auto }
 *   fixed → { flexGrow: 0, flexShrink: 0, [axis]: "<px>" }
 *
 * Flex child — cross axis:
 *   fill  → { [axis]: "100%", alignSelf: "stretch" }
 *   hug   → { [axis]: "auto" } + alignSelf: "flex-start" if currently stretch/auto/unset
 *   fixed → { [axis]: "<px>" }
 */
export function computeSizingChanges(
  axis: "width" | "height",
  mode: SizingMode,
  ctx: SizingContext,
): Record<string, string> {
  const { isFlexChild, isGridChild, parentFlexDir, currentStyles, elementRect } = ctx;

  const pxValue = (): string => {
    const val = elementRect
      ? Math.round(axis === "width" ? elementRect.width : elementRect.height)
      : 200;
    return `${val}px`;
  };

  // ── Non-flex elements (block, grid children, etc.) ──
  if (!isFlexChild) {
    if (isGridChild) {
      return computeGridChildChanges(axis, mode, currentStyles, pxValue);
    }
    return computeBlockChanges(axis, mode, pxValue);
  }

  // ── Flex child ──
  const isMainAxis =
    (axis === "width" && !parentFlexDir.startsWith("column")) ||
    (axis === "height" && parentFlexDir.startsWith("column"));

  if (isMainAxis) {
    return computeFlexMainAxisChanges(axis, mode, currentStyles, pxValue);
  }
  return computeFlexCrossAxisChanges(axis, mode, currentStyles, pxValue);
}

// ── Internal helpers ──

function computeBlockChanges(
  axis: "width" | "height",
  mode: SizingMode,
  pxValue: () => string,
): Record<string, string> {
  switch (mode) {
    case "fill":
      return { [axis]: "100%" };
    case "hug":
      return { [axis]: "fit-content" };
    case "fixed":
      return { [axis]: pxValue() };
  }
}

function computeGridChildChanges(
  axis: "width" | "height",
  mode: SizingMode,
  currentStyles: Record<string, string>,
  pxValue: () => string,
): Record<string, string> {
  const selfProp = axis === "width" ? "justifySelf" : "alignSelf";

  switch (mode) {
    case "fill":
      return { [axis]: "auto", [selfProp]: "stretch" };
    case "hug": {
      const changes: Record<string, string> = { [axis]: "fit-content" };
      const currentSelf = currentStyles[selfProp];
      if (!currentSelf || currentSelf === "stretch" || currentSelf === "auto" || currentSelf === "normal") {
        changes[selfProp] = "start";
      }
      return changes;
    }
    case "fixed":
      return { [axis]: pxValue() };
  }
}

function computeFlexMainAxisChanges(
  axis: "width" | "height",
  mode: SizingMode,
  currentStyles: Record<string, string>,
  pxValue: () => string,
): Record<string, string> {
  switch (mode) {
    case "fill":
      return {
        flexGrow: "1",
        flexShrink: "1",
        flexBasis: "0px",
        [axis]: "auto",
      };
    case "hug":
      return {
        flexGrow: "0",
        flexShrink: "0",
        flexBasis: "auto",
        [axis]: "auto",
      };
    case "fixed": {
      const changes: Record<string, string> = {
        flexGrow: "0",
        flexShrink: "0",
      };
      if (!currentStyles[axis] || currentStyles[axis] === "auto") {
        changes[axis] = pxValue();
      }
      return changes;
    }
  }
}

function computeFlexCrossAxisChanges(
  axis: "width" | "height",
  mode: SizingMode,
  currentStyles: Record<string, string>,
  pxValue: () => string,
): Record<string, string> {
  switch (mode) {
    case "fill": {
      const changes: Record<string, string> = { [axis]: "100%" };
      // Only change alignSelf if width isn't already 100% (avoid unwanted alignment shifts)
      if (currentStyles[axis] !== "100%") {
        changes.alignSelf = "stretch";
      }
      return changes;
    }
    case "hug": {
      const changes: Record<string, string> = { [axis]: "auto" };
      const currentAlignSelf = currentStyles.alignSelf;
      if (!currentAlignSelf || currentAlignSelf === "auto" || currentAlignSelf === "stretch") {
        changes.alignSelf = "flex-start";
      }
      return changes;
    }
    case "fixed": {
      const changes: Record<string, string> = {};
      if (!currentStyles[axis] || currentStyles[axis] === "auto" || currentStyles[axis] === "100%") {
        changes[axis] = pxValue();
      }
      return changes;
    }
  }
}

/**
 * Check whether fill mode is valid for the given axis in the current layout context.
 * Width fill is almost always valid. Height fill depends on parent context.
 */
export function canFill(
  axis: "width" | "height",
  ctx: SizingContext,
): boolean {
  // Width fill is almost always valid
  if (axis === "width") return true;

  const { isFlexChild, isGridChild, parentFlexDir, currentStyles } = ctx;

  // Flex column parent → flex: 1 works for height fill
  if (isFlexChild && parentFlexDir.startsWith("column")) return true;

  // Flex row parent → cross axis stretch works if parent has height
  if (isFlexChild && !parentFlexDir.startsWith("column")) return true;

  // Grid → height: 100% works (cells have explicit dimensions)
  if (isGridChild) return true;

  // Block → only if parent has explicit height (not auto)
  // We check via currentStyles if the parent's height resolves to something other than auto
  // This is a heuristic — we can't easily check the parent's computed height from here
  // So we allow it and let the browser handle it
  return false;
}

/**
 * Detect whether an axis is currently in fill, hug, or fixed mode.
 * This is the inverse of computeSizingChanges — reads current styles
 * and returns the semantic sizing mode for display purposes.
 */
export function detectSizingMode(
  axis: "width" | "height",
  ctx: SizingContext,
): SizingMode | null {
  const { isFlexChild, isGridChild, parentFlexDir, currentStyles } = ctx;
  const val = currentStyles[axis];

  if (!isFlexChild && !isGridChild) {
    if (val === "100%") return "fill";
    if (val === "fit-content") return "hug";
    return null;
  }

  if (isGridChild) {
    const selfProp = axis === "width" ? "justifySelf" : "alignSelf";
    const selfVal = currentStyles[selfProp];
    if ((val === "auto" || !val) && (selfVal === "stretch" || selfVal === "auto" || selfVal === "normal" || !selfVal)) return "fill";
    if (val === "fit-content") return "hug";
    return null;
  }

  const isMainAxis =
    (axis === "width" && !parentFlexDir.startsWith("column")) ||
    (axis === "height" && parentFlexDir.startsWith("column"));

  if (isMainAxis) {
    const grow = currentStyles.flexGrow;
    const basis = currentStyles.flexBasis;
    if (grow && parseFloat(grow) > 0 && (basis === "0px" || basis === "0" || basis === "0%")) return "fill";
    if (grow === "0" && (basis === "auto" || !basis) && (val === "auto" || !val)) return "hug";
    return null;
  }

  // Cross axis — width: 100% is "fill" regardless of alignSelf
  if (val === "100%") return "fill";
  const alignSelf = currentStyles.alignSelf;
  if ((val === "auto" || !val) && (alignSelf === "stretch" || alignSelf === "auto" || alignSelf === "normal" || !alignSelf)) return "fill";
  if (val === "auto" && (alignSelf === "flex-start" || alignSelf === "start" || alignSelf === "center" || alignSelf === "flex-end" || alignSelf === "end")) return "hug";
  return null;
}

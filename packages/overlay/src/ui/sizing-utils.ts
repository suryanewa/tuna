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
    case "fill":
      return { [axis]: "100%", alignSelf: "stretch" };
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

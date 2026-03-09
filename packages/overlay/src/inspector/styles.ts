/**
 * Extract computed styles relevant to the element type.
 * Rather than dumping all 300+ computed properties, we extract
 * a curated set based on what's visually meaningful.
 */

import { camelToKebab } from "../utils";

const SPACING_PROPS = [
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "marginTop", "marginRight", "marginBottom", "marginLeft",
] as const;

const SIZING_PROPS = [
  "width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight",
] as const;

const BORDER_PROPS = [
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor",
  "borderTopStyle", "borderRightStyle", "borderBottomStyle", "borderLeftStyle",
  "borderTopLeftRadius", "borderTopRightRadius",
  "borderBottomLeftRadius", "borderBottomRightRadius",
] as const;

const TYPOGRAPHY_PROPS = [
  "fontSize", "fontWeight", "fontFamily", "fontStyle", "lineHeight",
  "letterSpacing", "textAlign", "verticalAlign", "textDecoration", "textTransform",
  "whiteSpace", "wordSpacing", "textIndent",
  "color",
] as const;

const BACKGROUND_PROPS = [
  "backgroundColor", "backgroundImage",
] as const;

const LAYOUT_PROPS = [
  "display", "position",
  "flexDirection", "flexWrap", "alignItems", "justifyContent", "gap", "rowGap", "columnGap",
  "gridTemplateColumns", "gridTemplateRows",
  "top", "right", "bottom", "left",
  "zIndex",
  // Flex child
  "flexGrow", "flexShrink", "flexBasis", "alignSelf", "order",
  // Grid child
  "gridColumn", "gridRow", "justifySelf",
] as const;

const VISUAL_PROPS = [
  "opacity", "overflow", "boxShadow", "textShadow", "transform",
  "filter", "backdropFilter",
] as const;

const TEXT_OVERFLOW_PROPS = [
  "textOverflow", "overflowWrap", "wordBreak",
  "webkitLineClamp", "webkitBoxOrient",
] as const;

const ALL_PROPS = [
  ...SPACING_PROPS,
  ...SIZING_PROPS,
  ...BORDER_PROPS,
  ...TYPOGRAPHY_PROPS,
  ...BACKGROUND_PROPS,
  ...LAYOUT_PROPS,
  ...VISUAL_PROPS,
  ...TEXT_OVERFLOW_PROPS,
] as const;

export type LayoutMode = "block" | "flex" | "grid" | "inline" | "absolute" | "fixed" | "relative" | "sticky";

// Properties where "normal" should be resolved to "0px" for usability
const NORMAL_TO_ZERO = new Set(["gap", "rowGap", "columnGap"]);

export function getRelevantStyles(element: Element): Record<string, string> {
  const computed = window.getComputedStyle(element);
  const styles: Record<string, string> = {};

  for (const prop of ALL_PROPS) {
    let value = computed.getPropertyValue(camelToKebab(prop));
    if (value) {
      if (value === "normal" && NORMAL_TO_ZERO.has(prop)) {
        value = "0px";
      }
      styles[prop] = value;
    }
  }

  return styles;
}

export function detectLayoutMode(element: Element): LayoutMode {
  const computed = window.getComputedStyle(element);
  const display = computed.display;
  const position = computed.position;

  if (position === "fixed") return "fixed";
  if (position === "absolute") return "absolute";
  if (position === "sticky") return "sticky";
  if (position === "relative") return "relative";
  if (display.includes("flex")) return "flex";
  if (display.includes("grid")) return "grid";
  if (display.includes("inline")) return "inline";
  return "block";
}



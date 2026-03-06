/**
 * Extract computed styles relevant to the element type.
 * Rather than dumping all 300+ computed properties, we extract
 * a curated set based on what's visually meaningful.
 */

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
  "fontSize", "fontWeight", "fontFamily", "lineHeight",
  "letterSpacing", "textAlign", "textDecoration", "textTransform",
  "color",
] as const;

const BACKGROUND_PROPS = [
  "backgroundColor", "backgroundImage",
] as const;

const LAYOUT_PROPS = [
  "display", "position",
  "flexDirection", "flexWrap", "alignItems", "justifyContent", "gap",
  "gridTemplateColumns", "gridTemplateRows", "gridGap",
  "top", "right", "bottom", "left",
  "zIndex",
] as const;

const VISUAL_PROPS = [
  "opacity", "overflow", "boxShadow", "transform",
] as const;

const ALL_PROPS = [
  ...SPACING_PROPS,
  ...SIZING_PROPS,
  ...BORDER_PROPS,
  ...TYPOGRAPHY_PROPS,
  ...BACKGROUND_PROPS,
  ...LAYOUT_PROPS,
  ...VISUAL_PROPS,
] as const;

export type LayoutMode = "block" | "flex" | "grid" | "inline" | "absolute" | "fixed";

export function getRelevantStyles(element: Element): Record<string, string> {
  const computed = window.getComputedStyle(element);
  const styles: Record<string, string> = {};

  for (const prop of ALL_PROPS) {
    const value = computed.getPropertyValue(camelToKebab(prop));
    if (value) {
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
  if (display.includes("flex")) return "flex";
  if (display.includes("grid")) return "grid";
  if (display.includes("inline")) return "inline";
  return "block";
}

/** Get only the styles relevant to a specific control category */
export function getStylesForCategory(
  element: Element,
  category: "spacing" | "sizing" | "border" | "typography" | "background" | "layout" | "visual"
): Record<string, string> {
  const computed = window.getComputedStyle(element);
  const props = {
    spacing: SPACING_PROPS,
    sizing: SIZING_PROPS,
    border: BORDER_PROPS,
    typography: TYPOGRAPHY_PROPS,
    background: BACKGROUND_PROPS,
    layout: LAYOUT_PROPS,
    visual: VISUAL_PROPS,
  }[category];

  const styles: Record<string, string> = {};
  for (const prop of props) {
    const value = computed.getPropertyValue(camelToKebab(prop));
    if (value) styles[prop] = value;
  }
  return styles;
}

function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

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
  "backgroundSize", "backgroundPosition", "backgroundRepeat",
] as const;

const MEDIA_PROPS = [
  "objectFit", "objectPosition", "aspectRatio",
] as const;

const SVG_PROPS = [
  "fill", "stroke", "strokeWidth",
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
  ...MEDIA_PROPS,
  ...SVG_PROPS,
  ...LAYOUT_PROPS,
  ...VISUAL_PROPS,
  ...TEXT_OVERFLOW_PROPS,
] as const;

export type LayoutMode = "block" | "flex" | "grid" | "inline" | "absolute" | "fixed" | "relative" | "sticky";

export type ForcedState = ":hover" | ":focus" | ":active" | null;

/**
 * Find CSS rules that apply to a given element under a specific pseudo-state
 * (e.g. :hover). Returns a map of property → value for all matching rules.
 */
export function getPseudoStateStyles(
  element: Element,
  state: ":hover" | ":focus" | ":active",
): Record<string, string> {
  const styles: Record<string, string> = {};
  const stateRegex = new RegExp(state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g");

  function walkRules(rules: CSSRuleList) {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];

      // Recurse into @layer, @media, @supports, etc.
      // Skip @media rules whose condition doesn't match the current viewport.
      if (rule instanceof CSSGroupingRule ||
          (typeof CSSLayerBlockRule !== "undefined" && rule instanceof CSSLayerBlockRule)) {
        if (rule instanceof CSSMediaRule && !window.matchMedia(rule.conditionText).matches) continue;
        walkRules((rule as CSSGroupingRule).cssRules);
        continue;
      }

      if (!(rule instanceof CSSStyleRule)) continue;
      const sel = rule.selectorText;
      if (!sel.includes(state)) continue;

      // Strip the pseudo-state to get the base selector, then check if element matches
      const baseSel = sel.replace(stateRegex, "").replace(/\s+/g, " ").trim();
      if (!baseSel) continue;

      try {
        if (!element.matches(baseSel)) continue;
      } catch {
        continue; // invalid selector
      }

      // Collect properties from this rule
      for (let j = 0; j < rule.style.length; j++) {
        const prop = rule.style[j];
        styles[prop] = rule.style.getPropertyValue(prop);
      }
    }
  }

  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet
    }
    walkRules(rules);
  }

  return expandShorthands(styles);
}

/**
 * Expand CSS shorthand properties to their longhand equivalents.
 * When stylesheet rules use shorthands like `padding: 10px 20px`, the CSSOM
 * enumerates only the shorthand — the individual longhands (padding-left, etc.)
 * are missing. This function detects known shorthands and expands them so
 * downstream consumers always see individual longhand values.
 */
function expandShorthands(styles: Record<string, string>): Record<string, string> {
  const result = { ...styles };

  // Helper: parse 1–4 value shorthand (padding, margin, border-width, etc.)
  function expandBoxValues(
    shorthand: string,
    sides: [string, string, string, string],
  ) {
    if (!(shorthand in result)) return;
    const raw = result[shorthand].trim();
    const parts = raw.split(/\s+/);
    let top: string, right: string, bottom: string, left: string;
    switch (parts.length) {
      case 1:
        top = right = bottom = left = parts[0];
        break;
      case 2:
        top = bottom = parts[0];
        right = left = parts[1];
        break;
      case 3:
        top = parts[0];
        right = left = parts[1];
        bottom = parts[2];
        break;
      default: // 4+
        top = parts[0];
        right = parts[1];
        bottom = parts[2];
        left = parts[3];
        break;
    }
    // Only set longhands that aren't already explicitly declared
    if (!(sides[0] in result)) result[sides[0]] = top;
    if (!(sides[1] in result)) result[sides[1]] = right;
    if (!(sides[2] in result)) result[sides[2]] = bottom;
    if (!(sides[3] in result)) result[sides[3]] = left;
    delete result[shorthand];
  }

  // Helper: expand border-radius (uses a slightly different 1–4 pattern for corners)
  function expandBorderRadius() {
    if (!("border-radius" in result)) return;
    const raw = result["border-radius"].trim();
    // Handle slash syntax (horizontal / vertical) — take horizontal only for simplicity
    const horizontal = raw.split("/")[0].trim();
    const parts = horizontal.split(/\s+/);
    const corners = [
      "border-top-left-radius",
      "border-top-right-radius",
      "border-bottom-right-radius",
      "border-bottom-left-radius",
    ];
    let tl: string, tr: string, br: string, bl: string;
    switch (parts.length) {
      case 1:
        tl = tr = br = bl = parts[0];
        break;
      case 2:
        tl = br = parts[0];
        tr = bl = parts[1];
        break;
      case 3:
        tl = parts[0];
        tr = bl = parts[1];
        br = parts[2];
        break;
      default:
        tl = parts[0];
        tr = parts[1];
        br = parts[2];
        bl = parts[3];
        break;
    }
    if (!(corners[0] in result)) result[corners[0]] = tl;
    if (!(corners[1] in result)) result[corners[1]] = tr;
    if (!(corners[2] in result)) result[corners[2]] = br;
    if (!(corners[3] in result)) result[corners[3]] = bl;
    delete result["border-radius"];
  }

  // Helper: expand gap → row-gap + column-gap
  function expandGap() {
    if (!("gap" in result)) return;
    const raw = result["gap"].trim();
    const parts = raw.split(/\s+/);
    const rowGap = parts[0];
    const colGap = parts.length > 1 ? parts[1] : parts[0];
    if (!("row-gap" in result)) result["row-gap"] = rowGap;
    if (!("column-gap" in result)) result["column-gap"] = colGap;
    delete result["gap"];
  }

  // Expand known shorthands
  expandBoxValues("padding", [
    "padding-top", "padding-right", "padding-bottom", "padding-left",
  ]);
  expandBoxValues("margin", [
    "margin-top", "margin-right", "margin-bottom", "margin-left",
  ]);
  expandBoxValues("border-width", [
    "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  ]);
  expandBoxValues("border-color", [
    "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  ]);
  expandBoxValues("border-style", [
    "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
  ]);
  expandBorderRadius();
  expandGap();

  return result;
}

export type StyleSource = {
  /** The CSS selector that sets this property (e.g. ".btn", ".btn-primary") */
  selector: string;
  /** The value declared in the stylesheet rule */
  value: string;
};

/**
 * For each CSS property on an element, find which stylesheet selector sets it.
 * Returns a map of camelCase property → StyleSource.
 * Later rules / higher specificity wins (simplified: last-match-wins like browsers).
 */
export function getStyleSources(element: Element): Record<string, StyleSource> {
  const sources: Record<string, StyleSource> = {};

  function walkRules(rules: CSSRuleList) {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (rule instanceof CSSGroupingRule ||
          (typeof CSSLayerBlockRule !== "undefined" && rule instanceof CSSLayerBlockRule)) {
        if (rule instanceof CSSMediaRule && !window.matchMedia(rule.conditionText).matches) continue;
        walkRules((rule as CSSGroupingRule).cssRules);
        continue;
      }
      if (!(rule instanceof CSSStyleRule)) continue;
      const sel = rule.selectorText;
      if (sel.includes(":hover") || sel.includes(":focus") || sel.includes(":active")) continue;
      try { if (!element.matches(sel)) continue; } catch { continue; }
      for (let j = 0; j < rule.style.length; j++) {
        const prop = rule.style[j];
        const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        sources[camel] = { selector: sel, value: rule.style.getPropertyValue(prop) };
      }
    }
  }

  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }
    walkRules(rules);
  }

  return sources;
}

/**
 * Get styles scoped to a specific selector. Only returns property values
 * from stylesheet rules whose selector contains the given scopeSelector
 * (e.g. scoping to ".toc-link" includes ".toc-link" and ".sidebar .toc-link"
 * but excludes ".toc-link.active" since that's a more specific variant).
 *
 * For properties not set by any matching rule, falls back to computed style.
 */
export interface ScopedStyleResult {
  styles: Record<string, string>;
  /** camelCase properties that are set by CSS rules matching the scope selector */
  ownedProperties: Set<string>;
}

export function getScopedStyles(
  element: Element,
  scopeSelector: string,
): ScopedStyleResult {
  // Collect owned properties AND their resolved values from scope-matching rules.
  // A probe element resolves var() references to actual values.
  const ownedProperties = new Set<string>();
  const scopedValues: Record<string, string> = {};
  const scopedSpecificity: Record<string, number> = {};

  const scopeClasses: string[] = scopeSelector.match(/\.[a-zA-Z0-9_-]+/g) || [];

  // Probe element for resolving var() values
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:-9999px;left:-9999px;visibility:hidden;pointer-events:none;";
  document.body.appendChild(probe);

  function resolveRuleValue(rule: CSSStyleRule, prop: string): string {
    let val = rule.style.getPropertyValue(prop).trim();
    if (!val) {
      for (const sh of ["padding", "margin", "border-radius", "gap", "border-width", "border-color", "border-style"]) {
        const shVal = rule.style.getPropertyValue(sh).trim();
        if (shVal && prop.startsWith(sh.split("-")[0])) {
          probe.style.setProperty(sh, shVal);
          val = getComputedStyle(probe).getPropertyValue(prop).trim();
          probe.style.removeProperty(sh);
          break;
        }
      }
    } else if (val.includes("var(")) {
      probe.style.setProperty(prop, val);
      val = getComputedStyle(probe).getPropertyValue(prop).trim();
      probe.style.removeProperty(prop);
    }
    return val;
  }

  function walkScopedRules(rules: CSSRuleList) {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (rule instanceof CSSGroupingRule ||
          (typeof CSSLayerBlockRule !== "undefined" && rule instanceof CSSLayerBlockRule)) {
        if (rule instanceof CSSMediaRule && !window.matchMedia(rule.conditionText).matches) continue;
        walkScopedRules((rule as CSSGroupingRule).cssRules);
        continue;
      }
      if (!(rule instanceof CSSStyleRule)) continue;
      const sel = rule.selectorText;
      if (sel.includes(":hover") || sel.includes(":focus") || sel.includes(":active")) continue;
      try { if (!element.matches(sel)) continue; } catch { continue; }

      const ruleClasses: string[] = sel.match(/\.[a-zA-Z0-9_-]+/g) || [];
      if (ruleClasses.length === 0) continue;

      // Include rules where all classes are within scope (rule ⊆ scope)
      // OR rules that are a superset of scope (scope ⊆ rule) — these have
      // higher specificity and override scope values in the cascade.
      const ruleWithinScope = ruleClasses.every((rc) => scopeClasses.includes(rc));
      const ruleSupersetOfScope = !ruleWithinScope &&
        scopeClasses.every((sc) => ruleClasses.includes(sc));

      if (!ruleWithinScope && !ruleSupersetOfScope) continue;

      const ruleSpecificity = ruleClasses.length;
      for (let j = 0; j < rule.style.length; j++) {
        const prop = rule.style[j];
        const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        if (ruleWithinScope) ownedProperties.add(camel);
        const val = resolveRuleValue(rule, prop);
        if (!val) continue;
        // Respect CSS specificity: only overwrite if new rule has >= specificity.
        // For class-only selectors, specificity = number of classes.
        // Equal specificity + later in source = wins (CSS cascade).
        const prevSpec = scopedSpecificity[camel] ?? -1;
        if (ruleSpecificity >= prevSpec) {
          scopedValues[camel] = val;
          scopedSpecificity[camel] = ruleSpecificity;
        }
      }
    }
  }

  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }
    walkScopedRules(rules);
  }

  probe.remove();


  // Use scoped values for owned properties, computed values for everything else.
  // This ensures .alert's padding shows its own value (16px), not the cascade
  // result after .alert-dismissible overrides padding-right to 40px.
  const computed = window.getComputedStyle(element);
  const styles: Record<string, string> = {};

  for (const prop of ALL_PROPS) {
    // Prefer scoped value if this property is owned by a matching rule
    if (scopedValues[prop]) {
      styles[prop] = scopedValues[prop];
      continue;
    }
    let value = computed.getPropertyValue(camelToKebab(prop));
    if (value) {
      if (value === "normal" && NORMAL_TO_ZERO.has(prop)) {
        value = "0px";
      }
      styles[prop] = value;
    }
  }

  return { styles, ownedProperties };
}

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



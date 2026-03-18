/**
 * Token Resolver — given an element and its computed styles, find which
 * utility-class tokens currently provide each property's value.
 *
 * This powers the "this value comes from class py-4" indicator on inputs,
 * and enables "swap py-3 → py-4" prescriptive output.
 */

import type { DesignVariable, VariableMatch, VariableRegistry, VariableCategory } from "./types";
import { getVariableRegistry } from "./registry";
import { getCategoryForProperty } from "./categories";
import { scanDesignTokens, type DesignToken } from "../inspector/tokens";

const SPACE_RGB_RE = /^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*$/;

export function isSpaceSeparatedRgb(value: string): boolean {
  const m = SPACE_RGB_RE.exec(value.trim());
  if (!m) return false;
  return [m[1], m[2], m[3]].every(n => { const v = parseInt(n, 10); return v >= 0 && v <= 255; });
}

function normalizeColorValue(value: string): string {
  if (isSpaceSeparatedRgb(value)) return `rgb(${value.trim().replace(/\s+/g, ', ')})`;
  return value;
}

const FRAMEWORK_INTERNAL_PREFIXES = ["--tw-", "--chakra-", "--mantine-", "--radix-", "--nextui-"];

/**
 * Resolve which tokens are active on a given element.
 * Returns a map of CSS property → VariableMatch (the token providing that value).
 *
 * Detects two kinds of tokens:
 * 1. Utility classes: element has a class like "spacing-xl" whose values match computed styles
 * 2. CSS variables: element's applied styles (inline or from rules) use var(--name) references
 */
export function resolveVariablesForElement(
  element: Element,
  computedStyles: Record<string, string>,
  /** Optional scope selector — when provided, only scan rules matching this scope */
  scopeSelector?: string,
): Map<string, VariableMatch> {
  const registry = getVariableRegistry();
  const matches = new Map<string, VariableMatch>();

  // ── 1. Class-based token resolution ──
  const classes = element.classList ? Array.from(element.classList) : [];
  if (classes.length > 0) {
    const activeTokens: DesignVariable[] = [];
    for (const cls of classes) {
      const token = registry.classLookup.get(cls);
      if (token) activeTokens.push(token);
    }

    for (const token of activeTokens) {
      for (const [prop, tokenValue] of Object.entries(token.values)) {
        const camelProp = kebabToCamel(prop);
        const computed = computedStyles[camelProp] || computedStyles[prop];
        if (!computed) continue;

        const normalizedToken = normalizeValue(tokenValue);
        const normalizedComputed = normalizeValue(computed);

        if (normalizedToken === normalizedComputed) {
          matches.set(prop, { variable: token, property: prop });
        }
      }
    }
  }

  // ── 2. CSS variable detection ──
  // Check inline styles and matched stylesheet rules for var(--*) references
  resolveVarReferences(element, matches, scopeSelector);

  return matches;
}

/** Regex to extract var(--name) from a CSS value */
const VAR_REF_RE = /var\((--[a-zA-Z0-9_-]+)/g;

/**
 * Shorthand → longhand mapping. When a shorthand like `padding` uses var(),
 * browsers expand it into longhands with empty values. We need to check the
 * shorthand and apply the match to all its longhands.
 */
const SHORTHAND_LONGHANDS: Record<string, string[]> = {
  "padding": ["padding-top", "padding-right", "padding-bottom", "padding-left"],
  "margin": ["margin-top", "margin-right", "margin-bottom", "margin-left"],
  "border-radius": ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"],
  "gap": ["row-gap", "column-gap"],
  "border-width": ["border-top-width", "border-right-width", "border-bottom-width", "border-left-width"],
  "border-color": ["border-top-color", "border-right-color", "border-bottom-color", "border-left-color"],
  "border-style": ["border-top-style", "border-right-style", "border-bottom-style", "border-left-style"],
  "inset": ["top", "right", "bottom", "left"],
};

/**
 * Scan an element's applied styles for var(--*) references and add matching
 * CSS variable tokens to the matches map. Class-based matches take priority.
 */
function resolveVarReferences(element: Element, matches: Map<string, VariableMatch>, scopeSelector?: string): void {
  const htmlEl = element as HTMLElement;

  // Build a lookup of known CSS variable tokens: "--name" → DesignVariable
  const { tokens: varTokens } = getCssVariables();
  if (varTokens.length === 0) return;
  const varLookup = new Map<string, DesignVariable>();
  for (const t of varTokens) {
    const name = t.className.slice(4, -1); // strip "var(" and ")"
    varLookup.set(name, t);
  }

  /** Try to match a var() reference and add to matches */
  const tryMatch = (prop: string, raw: string) => {
    if (!raw.includes("var(")) return;
    // Allow CSS variable to overwrite a raw utility match (e.g., Tailwind p-4)
    // so the variable isn't lost when the utility gets filtered in getVariableMatch
    const existing = matches.get(prop);
    if (existing && !isRawUtility(existing.variable)) return;

    // Find the first var() reference that exists in our token lookup
    VAR_REF_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    let variable: DesignVariable | undefined;
    while ((m = VAR_REF_RE.exec(raw)) !== null) {
      variable = varLookup.get(m[1]);
      if (variable) break;
    }
    if (!variable) return;

    // If this is a shorthand, apply to all longhands
    const longhands = SHORTHAND_LONGHANDS[prop];
    if (longhands) {
      for (const lh of longhands) {
        const lhExisting = matches.get(lh);
        if (!lhExisting || isRawUtility(lhExisting.variable)) {
          matches.set(lh, { variable, property: lh });
        }
      }
    } else {
      matches.set(prop, { variable, property: prop });
    }
  };

  /** Clear a var match when a higher-specificity rule overrides with a raw value */
  const tryClear = (prop: string, raw: string) => {
    if (!raw || raw === "") return;     // shorthand expansion artifact, skip
    if (raw.includes("var(")) return;   // still a var reference, don't clear
    matches.delete(prop);               // raw value overrides previous var match
  };

  // Check inline styles (highest priority — clears any stylesheet var match)
  if (htmlEl.style && htmlEl.style.length > 0) {
    // First check longhand properties from style.item()
    for (let i = 0; i < htmlEl.style.length; i++) {
      const prop = htmlEl.style.item(i);
      const raw = htmlEl.style.getPropertyValue(prop);
      tryMatch(prop, raw);
      tryClear(prop, raw);
    }

    // Then check shorthands — browsers expand them into longhands with empty
    // values, so the var() reference is only on the shorthand itself
    for (const shorthand of Object.keys(SHORTHAND_LONGHANDS)) {
      const raw = htmlEl.style.getPropertyValue(shorthand);
      if (raw) tryMatch(shorthand, raw);
    }
  }

  // Extract scope classes for filtering (if scope provided)
  const scopeClasses = scopeSelector?.match(/\.[a-zA-Z0-9_-]+/g) || null;

  // Check matched stylesheet rules for var() references
  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (!(rule instanceof CSSStyleRule)) continue;
          if (!element.matches(rule.selectorText)) continue;

          // When scoped, only process rules whose classes are a subset of the scope
          if (scopeClasses) {
            const ruleClasses = rule.selectorText.match(/\.[a-zA-Z0-9_-]+/g) || [];
            if (ruleClasses.length === 0) continue; // skip universal selectors
            if (!ruleClasses.every(rc => scopeClasses.includes(rc))) continue;
          }

          for (let i = 0; i < rule.style.length; i++) {
            const prop = rule.style.item(i);
            const raw = rule.style.getPropertyValue(prop);
            tryMatch(prop, raw);
            tryClear(prop, raw);
          }
          // Also check shorthands in stylesheet rules
          for (const shorthand of Object.keys(SHORTHAND_LONGHANDS)) {
            const raw = rule.style.getPropertyValue(shorthand);
            if (raw) tryMatch(shorthand, raw);
          }
        }
      } catch {
        // Cross-origin stylesheet
      }
    }
  } catch {
    // Stylesheet access not supported
  }
}

/**
 * Find alternative tokens for a given property and category.
 * Returns tokens from the same category, sorted by the registry's ordering.
 * Accepts both camelCase and kebab-case property names.
 */
export function getAlternativeVariables(
  property: string,
  currentVariable?: DesignVariable,
): DesignVariable[] {
  const registry = getVariableRegistry();
  // Normalize: accept both camelCase ("paddingLeft") and kebab-case ("padding-left")
  const kebab = camelToKebab(property);
  const category = getCategoryForProperty(kebab);
  if (!category) return [];

  const group = registry.groups.get(category);
  if (!group) return [];

  // Return all tokens in the same category that affect the exact same property.
  // Exclude raw utilities — only show semantic tokens in the picker.
  return group.filter(t => {
    // Must affect the exact same property (token values always use kebab-case)
    if (!Object.keys(t.values).includes(kebab)) return false;
    // Exclude current token
    if (currentVariable && t.className === currentVariable.className) return false;
    // Exclude raw utilities: @layer is the definitive signal (v3+),
    // regex fallback for projects without @layer (v1/v2)
    if (isRawUtility(t)) return false;
    return true;
  });
}

/**
 * Find the best token swap for a property value change.
 * Given a property and new value, find the token whose value best matches.
 * Accepts both camelCase and kebab-case property names.
 */
export function findVariableForValue(
  property: string,
  value: string,
): DesignVariable | null {
  const registry = getVariableRegistry();
  // Normalize: accept both camelCase and kebab-case
  const kebab = camelToKebab(property);
  const key = `${kebab}:${normalizeValue(value)}`;

  // Direct lookup first
  const directMatches = registry.valueLookup.get(key);
  if (directMatches && directMatches.length > 0) {
    return directMatches[0];
  }

  // Fuzzy numeric match: find the closest token value
  const category = getCategoryForProperty(kebab);
  if (!category) return null;

  const group = registry.groups.get(category);
  if (!group) return null;

  const numValue = parseFloat(value);
  if (isNaN(numValue)) return null;

  let closest: DesignVariable | null = null;
  let closestDist = Infinity;

  for (const token of group) {
    const tokenVal = token.values[kebab];
    if (!tokenVal) continue;
    const tokenNum = parseFloat(tokenVal);
    if (isNaN(tokenNum)) continue;

    const dist = Math.abs(tokenNum - numValue);
    if (dist < closestDist) {
      closestDist = dist;
      closest = token;
    }
  }

  // Only return if reasonably close (within 2px or 10%)
  if (closest && closestDist <= Math.max(2, numValue * 0.1)) {
    return closest;
  }

  return null;
}

/** Normalize a CSS value for comparison */
function normalizeValue(val: string): string {
  return val.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Convert camelCase to kebab-case: "paddingLeft" → "padding-left". Already-kebab passes through. */
function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
}

/** Convert kebab-case to camelCase: "padding-top" → "paddingTop" */
function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Check if a token is a raw framework utility (not a semantic design token).
 *
 * Primary signal: @layer name. Tailwind v3+ puts all utilities in @layer utilities.
 * This is 100% accurate — no false positives possible.
 *
 * Fallback: regex for projects without @layer (Tailwind v1/v2, whose utility sets
 * are frozen and fully enumerable).
 */
export function isRawUtility(variable: DesignVariable): boolean {
  // Definitive: variable lives in @layer utilities
  if (variable.layerName === "utilities") return true;
  // No layer info — fall back to regex for legacy Tailwind (v1/v2)
  if (!variable.layerName) return TW_PREFIX_LEGACY.test(variable.className);
  // Variable is in a named layer that isn't "utilities" (e.g., "components", "base") — semantic
  return false;
}

/** Legacy regex for Tailwind v1/v2 (frozen utility sets, no @layer support) */
const TW_PREFIX_LEGACY = /^-?(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|w|h|min-w|max-w|min-h|max-h|gap|space-[xy]|text|bg|border|rounded|shadow|opacity|font|leading|tracking|z|inset|top|right|bottom|left|flex|grid|grid-cols|col-span|row-span|items|justify|self|place|order|overflow|ring|outline|divide|sr|not-sr|container|aspect|columns|break|decoration|underline|overline|no-underline|cursor|transition|duration|ease|delay|animate|scale|rotate|translate|skew|origin|fill|stroke|will-change|hidden|block|inline|inline-flex|inline-block|table|absolute|relative|fixed|sticky|float|clear|isolate|object|whitespace|align|indent|truncate|uppercase|lowercase|capitalize|normal-case|italic|not-italic|antialiased|subpixel|select|resize|appearance|accent|caret|snap|touch|scroll|hyphens|content|list)($|-)/;

/** Check if a class name looks like a Tailwind utility (not a semantic token) */
export function isTailwindUtility(className: string): boolean {
  return TW_PREFIX_LEGACY.test(className);
}

// ── CSS custom property categorization ──

/** Cached CSS variable tokens (invalidated when stylesheet count changes) */
let cssVarCache: { tokens: DesignVariable[]; byCategory: Map<VariableCategory, DesignVariable[]> } | null = null;
let cssVarSheetCount = -1;

/** Force CSS variable token cache to rebuild on next call */
export function invalidateCssVariables(): void {
  cssVarCache = null;
  cssVarSheetCount = -1;
}

/** Pattern-based category detection for CSS custom property names */
const VAR_CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: VariableCategory }> = [
  { pattern: /^--(spacing|space|gap|pad|margin)/i, category: "spacing" },
  { pattern: /^--(size|width|height)/i, category: "sizing" },
  { pattern: /^--(color|bg|text-color|border-color|foreground|background|accent|muted|destructive|primary|secondary)/i, category: "colors" },
  { pattern: /^--(font-size|text-(?:xs|sm|base|lg|xl|\d))/i, category: "font-size" },
  { pattern: /^--(font-weight|font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black))/i, category: "font-weight" },
  { pattern: /^--(leading|line-height)/i, category: "line-height" },
  { pattern: /^--(tracking|letter-spacing|letter)/i, category: "letter-spacing" },
  { pattern: /^--(font-family|font-(?:sans|serif|mono|display|body|heading))/i, category: "font-family" },
  { pattern: /^--(font|text)/i, category: "font-size" },
  { pattern: /^--(radius|border-radius|rounded)/i, category: "border-radius" },
  { pattern: /^--(border-width|border-w|stroke-width)/i, category: "border-width" },
  { pattern: /^--(shadow)/i, category: "box-shadow" },
  { pattern: /^--(opacity|alpha)/i, category: "opacity" },
];

/** Detect category from a CSS variable value */
function categoryFromValue(value: string): VariableCategory | null {
  const v = value.trim().toLowerCase();
  // Color values
  if (v.startsWith("#") || v.startsWith("rgb") || v.startsWith("hsl") || v.startsWith("oklch") || v.startsWith("oklab")) {
    return "colors";
  }
  // Font-weight: pure numbers 100-900
  const num = parseFloat(v);
  if (!isNaN(num) && /^\d{3}$/.test(v)) {
    return "font-weight";
  }
  // Font-family: contains commas or known font keywords
  if (v.includes(",") || /^(sans-serif|serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace)/.test(v)) {
    return "font-family";
  }
  // Pixel/rem values that are small likely spacing/sizing
  if (!isNaN(num) && (v.endsWith("px") || v.endsWith("rem") || v.endsWith("em"))) {
    return "spacing"; // Could be spacing or sizing, default to spacing
  }
  // Space-separated RGB channels (Tailwind v4, UDS pattern: "255 229 202")
  if (isSpaceSeparatedRgb(v)) return "colors";
  return null;
}

/** Categorize a CSS custom property into a token category */
function categorizeVariable(token: DesignToken): VariableCategory | null {
  // Try name-based patterns first
  for (const { pattern, category } of VAR_CATEGORY_PATTERNS) {
    if (pattern.test(token.name)) return category;
  }
  // Fall back to value-based detection
  return categoryFromValue(token.value);
}

// ── Usage-based categorization (scans stylesheets for var() references) ──

/**
 * Scan all stylesheet rules to build a map of CSS variable name → Set<CSS property>.
 * e.g., if a rule says `font-size: var(--text-lg)`, records "--text-lg" → {"font-size"}.
 * This is the definitive source for categorizing variables.
 */
function buildVariableUsageMap(): Map<string, Set<string>> {
  const usageMap = new Map<string, Set<string>>();

  function scanRuleList(rules: CSSRuleList) {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (rule instanceof CSSGroupingRule ||
          (typeof CSSLayerBlockRule !== "undefined" && rule instanceof CSSLayerBlockRule)) {
        scanRuleList((rule as CSSGroupingRule).cssRules);
        continue;
      }
      if (!(rule instanceof CSSStyleRule)) continue;
      // Fast pre-filter: skip rules with no var() references
      if (!rule.cssText.includes("var(")) continue;

      // Longhands from style.item() — preferred, most accurate
      for (let j = 0; j < rule.style.length; j++) {
        const prop = rule.style.item(j);
        if (prop.startsWith("--")) continue;
        const raw = rule.style.getPropertyValue(prop);
        extractVarUsages(prop, raw, usageMap);
      }
      // Shorthands that browsers don't enumerate via style.item()
      for (const shorthand of Object.keys(SHORTHAND_LONGHANDS)) {
        const raw = rule.style.getPropertyValue(shorthand);
        if (raw && raw.includes("var(")) {
          // Map to longhands, not the shorthand itself (avoids ambiguity)
          for (const lh of SHORTHAND_LONGHANDS[shorthand]) {
            extractVarUsages(lh, raw, usageMap);
          }
        }
      }
    }
  }

  try {
    for (const sheet of document.styleSheets) {
      try { scanRuleList(sheet.cssRules); } catch { /* cross-origin */ }
    }
  } catch { /* no access */ }
  return usageMap;
}

/** Extract var(--name) references from a CSS value and record which property uses them */
function extractVarUsages(prop: string, raw: string, map: Map<string, Set<string>>) {
  if (!raw.includes("var(")) return;
  VAR_REF_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = VAR_REF_RE.exec(raw)) !== null) {
    const varName = m[1];
    if (!map.has(varName)) map.set(varName, new Set());
    map.get(varName)!.add(prop);
  }
}

/** Categorize a variable by which CSS properties actually use it (majority vote) */
function categorizeFromUsage(
  varName: string,
  usageMap: Map<string, Set<string>>,
): VariableCategory | null {
  const props = usageMap.get(varName);
  if (!props || props.size === 0) return null;

  const counts = new Map<VariableCategory, number>();
  for (const prop of props) {
    const cat = getCategoryForProperty(prop);
    if (cat) counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  let best: VariableCategory | null = null;
  let bestCount = 0;
  for (const [cat, count] of counts) {
    if (count > bestCount) { best = cat; bestCount = count; }
  }
  return best;
}

/** Get CSS custom properties as DesignVariable format, grouped by category */
function getCssVariables(): { tokens: DesignVariable[]; byCategory: Map<VariableCategory, DesignVariable[]> } {
  const sheetCount = typeof document !== "undefined" ? document.styleSheets.length : 0;
  if (cssVarCache && cssVarSheetCount === sheetCount) return cssVarCache;

  const tokenMap = scanDesignTokens();
  const usageMap = buildVariableUsageMap();
  const tokens: DesignVariable[] = [];
  const byCategory = new Map<VariableCategory, DesignVariable[]>();
  const seen = new Set<string>();

  for (const dt of tokenMap.tokens) {
    // Deduplicate by variable name
    if (seen.has(dt.name)) continue;
    seen.add(dt.name);

    // Filter framework internals
    if (FRAMEWORK_INTERNAL_PREFIXES.some(p => dt.name.startsWith(p))) continue;

    // Usage-based first (definitive), name/value pattern fallback second
    const category = categorizeFromUsage(dt.name, usageMap) ?? categorizeVariable(dt);
    if (!category) continue;

    const ut: DesignVariable = {
      className: `var(${dt.name})`,
      values: { [dt.name]: normalizeColorValue(dt.value) },
    };
    tokens.push(ut);
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(ut);
  }

  cssVarCache = { tokens, byCategory };
  cssVarSheetCount = sheetCount;

  return cssVarCache;
}

/**
 * All CSS custom property tokens for a given CSS property (for the variable picker).
 * Only returns CSS variables — class-based tokens are excluded from the picker.
 * Accepts both camelCase and kebab-case property names.
 */
export function getVariablesForProperty(property: string): DesignVariable[] {
  const kebab = camelToKebab(property);
  const category = getCategoryForProperty(kebab);
  if (!category) return [];

  const cssVars = getCssVariables().byCategory.get(category) || [];
  const registry = getVariableRegistry();
  const classTokens = (registry.groups.get(category) || [])
    .filter(t => Object.keys(t.values).includes(kebab));
  return [...classTokens, ...cssVars];
}

/**
 * Quick boolean check — are there any CSS variables for this property's category?
 * Uses the variable picker data (not class-based tokens). Accepts camelCase or kebab-case.
 */
export function hasVariablesForProperty(property: string): boolean {
  const kebab = camelToKebab(property);
  const category = getCategoryForProperty(kebab);
  if (!category) return false;
  const { byCategory } = getCssVariables();
  if ((byCategory.get(category)?.length ?? 0) > 0) return true;
  const registry = getVariableRegistry();
  return (registry.groups.get(category) || []).some(t => Object.keys(t.values).includes(kebab));
}

/** Check if two properties are in the same shorthand family */
function isSameFamily(a: string, b: string): boolean {
  if (a === b) return true;
  // padding family
  if (a.startsWith("padding") && b.startsWith("padding")) return true;
  // margin family
  if (a.startsWith("margin") && b.startsWith("margin")) return true;
  // border-radius family
  if (a.includes("radius") && b.includes("radius")) return true;
  return false;
}

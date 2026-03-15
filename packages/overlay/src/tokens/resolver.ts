/**
 * Token Resolver — given an element and its computed styles, find which
 * utility-class tokens currently provide each property's value.
 *
 * This powers the "this value comes from class py-4" indicator on inputs,
 * and enables "swap py-3 → py-4" prescriptive output.
 */

import type { UtilityToken, TokenMatch, TokenRegistry, TokenCategory } from "./types";
import { getTokenRegistry } from "./registry";
import { getCategoryForProperty } from "./categories";
import { scanDesignTokens, type DesignToken } from "../inspector/tokens";

/**
 * Resolve which tokens are active on a given element.
 * Returns a map of CSS property → TokenMatch (the token providing that value).
 *
 * Detects two kinds of tokens:
 * 1. Utility classes: element has a class like "spacing-xl" whose values match computed styles
 * 2. CSS variables: element's applied styles (inline or from rules) use var(--name) references
 */
export function resolveTokensForElement(
  element: Element,
  computedStyles: Record<string, string>,
): Map<string, TokenMatch> {
  const registry = getTokenRegistry();
  const matches = new Map<string, TokenMatch>();

  // ── 1. Class-based token resolution ──
  const classes = element.classList ? Array.from(element.classList) : [];
  if (classes.length > 0) {
    const activeTokens: UtilityToken[] = [];
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
          matches.set(prop, { token, property: prop });
        }
      }
    }
  }

  // ── 2. CSS variable detection ──
  // Check inline styles and matched stylesheet rules for var(--*) references
  resolveVarTokens(element, matches);

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
};

/**
 * Scan an element's applied styles for var(--*) references and add matching
 * CSS variable tokens to the matches map. Class-based matches take priority.
 */
function resolveVarTokens(element: Element, matches: Map<string, TokenMatch>): void {
  const htmlEl = element as HTMLElement;

  // Build a lookup of known CSS variable tokens: "--name" → UtilityToken
  const { tokens: varTokens } = getCssVarTokens();
  if (varTokens.length === 0) return;
  const varLookup = new Map<string, UtilityToken>();
  for (const t of varTokens) {
    const name = t.className.slice(4, -1); // strip "var(" and ")"
    varLookup.set(name, t);
  }

  /** Try to match a var() reference and add to matches */
  const tryMatch = (prop: string, raw: string) => {
    if (!raw.includes("var(")) return;
    // Allow CSS variable to overwrite a raw utility match (e.g., Tailwind p-4)
    // so the variable isn't lost when the utility gets filtered in getTokenMatch
    const existing = matches.get(prop);
    if (existing && !isRawUtility(existing.token)) return;

    // Find the first var() reference that exists in our token lookup
    VAR_REF_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    let token: UtilityToken | undefined;
    while ((m = VAR_REF_RE.exec(raw)) !== null) {
      token = varLookup.get(m[1]);
      if (token) break;
    }
    if (!token) return;

    // If this is a shorthand, apply to all longhands
    const longhands = SHORTHAND_LONGHANDS[prop];
    if (longhands) {
      for (const lh of longhands) {
        const lhExisting = matches.get(lh);
        if (!lhExisting || isRawUtility(lhExisting.token)) {
          matches.set(lh, { token, property: lh });
        }
      }
    } else {
      matches.set(prop, { token, property: prop });
    }
  };

  // Check inline styles
  if (htmlEl.style && htmlEl.style.length > 0) {
    // First check longhand properties from style.item()
    for (let i = 0; i < htmlEl.style.length; i++) {
      const prop = htmlEl.style.item(i);
      const raw = htmlEl.style.getPropertyValue(prop);
      tryMatch(prop, raw);
    }

    // Then check shorthands — browsers expand them into longhands with empty
    // values, so the var() reference is only on the shorthand itself
    for (const shorthand of Object.keys(SHORTHAND_LONGHANDS)) {
      const raw = htmlEl.style.getPropertyValue(shorthand);
      if (raw) tryMatch(shorthand, raw);
    }
  }

  // Check matched stylesheet rules for var() references
  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (!(rule instanceof CSSStyleRule)) continue;
          if (!element.matches(rule.selectorText)) continue;

          for (let i = 0; i < rule.style.length; i++) {
            const prop = rule.style.item(i);
            const raw = rule.style.getPropertyValue(prop);
            tryMatch(prop, raw);
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
export function getAlternativeTokens(
  property: string,
  currentToken?: UtilityToken,
): UtilityToken[] {
  const registry = getTokenRegistry();
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
    if (currentToken && t.className === currentToken.className) return false;
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
export function findTokenForValue(
  property: string,
  value: string,
): UtilityToken | null {
  const registry = getTokenRegistry();
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

  let closest: UtilityToken | null = null;
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
export function isRawUtility(token: UtilityToken): boolean {
  // Definitive: token lives in @layer utilities
  if (token.layerName === "utilities") return true;
  // No layer info — fall back to regex for legacy Tailwind (v1/v2)
  if (!token.layerName) return TW_PREFIX_LEGACY.test(token.className);
  // Token is in a named layer that isn't "utilities" (e.g., "components", "base") — semantic
  return false;
}

/** Legacy regex for Tailwind v1/v2 (frozen utility sets, no @layer support) */
const TW_PREFIX_LEGACY = /^-?(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|w|h|min-w|max-w|min-h|max-h|gap|space-[xy]|text|bg|border|rounded|shadow|opacity|font|leading|tracking|z|inset|top|right|bottom|left|flex|grid|grid-cols|col-span|row-span|items|justify|self|place|order|overflow|ring|outline|divide|sr|not-sr|container|aspect|columns|break|decoration|underline|overline|no-underline|cursor|transition|duration|ease|delay|animate|scale|rotate|translate|skew|origin|fill|stroke|will-change|hidden|block|inline|inline-flex|inline-block|table|absolute|relative|fixed|sticky|float|clear|isolate|object|whitespace|align|indent|truncate|uppercase|lowercase|capitalize|normal-case|italic|not-italic|antialiased|subpixel|select|resize|appearance|accent|caret|snap|touch|scroll|hyphens|content|list)($|-)/;

/** Check if a class name looks like a Tailwind utility (not a semantic token) */
export function isTailwindUtility(className: string): boolean {
  return TW_PREFIX_LEGACY.test(className);
}

// ── CSS custom property categorization ──

/** Cached CSS variable tokens */
let cssVarTokensCache: { tokens: UtilityToken[]; byCategory: Map<TokenCategory, UtilityToken[]> } | null = null;

/** Pattern-based category detection for CSS custom property names */
const VAR_CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: TokenCategory }> = [
  { pattern: /^--(spacing|space|gap|pad|margin)/i, category: "spacing" },
  { pattern: /^--(size|width|height)/i, category: "sizing" },
  { pattern: /^--(color|bg|text-color|border-color|foreground|background|accent|muted|destructive|primary|secondary)/i, category: "colors" },
  { pattern: /^--(font|text|leading|tracking|letter)/i, category: "typography" },
  { pattern: /^--(radius|border-width|border-radius|rounded)/i, category: "borders" },
  { pattern: /^--(shadow|opacity)/i, category: "effects" },
];

/** Detect category from a CSS variable value */
function categoryFromValue(value: string): TokenCategory | null {
  const v = value.trim().toLowerCase();
  // Color values
  if (v.startsWith("#") || v.startsWith("rgb") || v.startsWith("hsl") || v.startsWith("oklch") || v.startsWith("oklab")) {
    return "colors";
  }
  // Pixel/rem values that are small likely spacing/sizing
  const num = parseFloat(v);
  if (!isNaN(num) && (v.endsWith("px") || v.endsWith("rem") || v.endsWith("em"))) {
    return "spacing"; // Could be spacing or sizing, default to spacing
  }
  return null;
}

/** Categorize a CSS custom property into a token category */
function categorizeVariable(token: DesignToken): TokenCategory | null {
  // Try name-based patterns first
  for (const { pattern, category } of VAR_CATEGORY_PATTERNS) {
    if (pattern.test(token.name)) return category;
  }
  // Fall back to value-based detection
  return categoryFromValue(token.value);
}

/** Get CSS custom properties as UtilityToken format, grouped by category */
function getCssVarTokens(): { tokens: UtilityToken[]; byCategory: Map<TokenCategory, UtilityToken[]> } {
  if (cssVarTokensCache) return cssVarTokensCache;

  const tokenMap = scanDesignTokens();
  const tokens: UtilityToken[] = [];
  const byCategory = new Map<TokenCategory, UtilityToken[]>();
  const seen = new Set<string>();

  for (const dt of tokenMap.tokens) {
    // Deduplicate by variable name
    if (seen.has(dt.name)) continue;
    seen.add(dt.name);

    const category = categorizeVariable(dt);
    if (!category) continue;

    const ut: UtilityToken = {
      className: `var(${dt.name})`,
      values: { [dt.name]: dt.value },
    };
    tokens.push(ut);
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(ut);
  }

  cssVarTokensCache = { tokens, byCategory };
  // Clear cache after 10s so re-scans pick up changes
  setTimeout(() => { cssVarTokensCache = null; }, 10000);

  return cssVarTokensCache;
}

/**
 * All CSS custom property tokens for a given CSS property (for the variable picker).
 * Only returns CSS variables — class-based tokens are excluded from the picker.
 * Accepts both camelCase and kebab-case property names.
 */
export function getTokensForProperty(property: string): UtilityToken[] {
  const kebab = camelToKebab(property);
  const category = getCategoryForProperty(kebab);
  if (!category) return [];

  const { byCategory } = getCssVarTokens();
  return byCategory.get(category) || [];
}

/**
 * Quick boolean check — are there any CSS variables for this property's category?
 * Uses the variable picker data (not class-based tokens). Accepts camelCase or kebab-case.
 */
export function hasTokensForProperty(property: string): boolean {
  const kebab = camelToKebab(property);
  const category = getCategoryForProperty(kebab);
  if (!category) return false;
  const { byCategory } = getCssVarTokens();
  return (byCategory.get(category)?.length ?? 0) > 0;
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

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

/**
 * Resolve which tokens are active on a given element.
 * Returns a map of CSS property → TokenMatch (the token providing that value).
 */
export function resolveTokensForElement(
  element: Element,
  computedStyles: Record<string, string>,
): Map<string, TokenMatch> {
  const registry = getTokenRegistry();
  const matches = new Map<string, TokenMatch>();

  // Get the element's class list
  const classes = element.classList ? Array.from(element.classList) : [];
  if (classes.length === 0) return matches;

  // Find tokens the element actually uses (by class name)
  const activeTokens: UtilityToken[] = [];
  for (const cls of classes) {
    const token = registry.classLookup.get(cls);
    if (token) activeTokens.push(token);
  }

  if (activeTokens.length === 0) return matches;

  // For each active token, check if its values match the element's computed styles.
  // Token values use kebab-case keys (from CSSStyleDeclaration iteration),
  // but computedStyles uses camelCase keys (from inspectElement). Convert.
  for (const token of activeTokens) {
    for (const [prop, tokenValue] of Object.entries(token.values)) {
      const camelProp = kebabToCamel(prop);
      const computed = computedStyles[camelProp] || computedStyles[prop];
      if (!computed) continue;

      // Normalize for comparison (strip whitespace, lowercase)
      const normalizedToken = normalizeValue(tokenValue);
      const normalizedComputed = normalizeValue(computed);

      if (normalizedToken === normalizedComputed) {
        // Store with kebab-case key (matches what the panel's tokenProps helper expects)
        matches.set(prop, { token, property: prop });
      }
    }
  }

  return matches;
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

/**
 * All semantic tokens for a given CSS property (for browsing when no token is applied).
 * Returns all non-raw tokens in the same category — e.g. spacing tokens show on
 * both padding and margin inputs, since the value scale is what matters.
 * Accepts both camelCase and kebab-case property names.
 */
export function getTokensForProperty(property: string): UtilityToken[] {
  const registry = getTokenRegistry();
  const kebab = camelToKebab(property);
  const category = getCategoryForProperty(kebab);
  if (!category) return [];
  const group = registry.groups.get(category);
  if (!group) return [];
  return group.filter(t => !isRawUtility(t));
}

/**
 * Quick boolean check — are there any semantic tokens for this property's category?
 * Uses .some() for early exit. Accepts camelCase or kebab-case.
 */
export function hasTokensForProperty(property: string): boolean {
  const registry = getTokenRegistry();
  const kebab = camelToKebab(property);
  const category = getCategoryForProperty(kebab);
  if (!category) return false;
  const group = registry.groups.get(category);
  if (!group) return false;
  return group.some(t => !isRawUtility(t));
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

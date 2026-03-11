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

  // For each active token, check if its values match the element's computed styles
  for (const token of activeTokens) {
    for (const [prop, tokenValue] of Object.entries(token.values)) {
      const computed = computedStyles[prop];
      if (!computed) continue;

      // Normalize for comparison (strip whitespace, lowercase)
      const normalizedToken = normalizeValue(tokenValue);
      const normalizedComputed = normalizeValue(computed);

      if (normalizedToken === normalizedComputed) {
        // This token provides this property's value
        matches.set(prop, { token, property: prop });
      }
    }
  }

  return matches;
}

/**
 * Find alternative tokens for a given property and category.
 * Returns tokens from the same category, sorted by the registry's ordering.
 */
export function getAlternativeTokens(
  property: string,
  currentToken?: UtilityToken,
): UtilityToken[] {
  const registry = getTokenRegistry();
  const category = getCategoryForProperty(property);
  if (!category) return [];

  const group = registry.groups.get(category);
  if (!group) return [];

  // Return all tokens in the same category that affect this property
  return group.filter(t => {
    // Must affect the same property
    if (!Object.keys(t.values).some(p => p === property || isSameFamily(p, property))) return false;
    // Exclude current token
    if (currentToken && t.className === currentToken.className) return false;
    return true;
  });
}

/**
 * Find the best token swap for a property value change.
 * Given a property and new value, find the token whose value best matches.
 */
export function findTokenForValue(
  property: string,
  value: string,
): UtilityToken | null {
  const registry = getTokenRegistry();
  const key = `${property}:${normalizeValue(value)}`;

  // Direct lookup first
  const directMatches = registry.valueLookup.get(key);
  if (directMatches && directMatches.length > 0) {
    return directMatches[0];
  }

  // Fuzzy numeric match: find the closest token value
  const category = getCategoryForProperty(property);
  if (!category) return null;

  const group = registry.groups.get(category);
  if (!group) return null;

  const numValue = parseFloat(value);
  if (isNaN(numValue)) return null;

  let closest: UtilityToken | null = null;
  let closestDist = Infinity;

  for (const token of group) {
    const tokenVal = token.values[property];
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

/**
 * Candidate resolver — for each changed property, finds matching
 * tokens, utility classes, and CSS variables to provide as context.
 *
 * Composes existing resolver/inspector functions into structured
 * EnrichedPropertyChange data. Used by both formatted output and
 * enriched raw JSON endpoints.
 */

import type { PropertyChange, PropertyCandidate, EnrichedPropertyChange } from "../types";
import type { TokenMap } from "../inspector/tokens";
import { findTokensForValue as findCssVarsForValue } from "../inspector/tokens";
import { findTokenForValue, getAlternativeTokens, isRawUtility } from "../tokens/resolver";
import { getTokenRegistry } from "../tokens/registry";
import { findStyleSources } from "../inspector/style-source";
import { camelToKebab } from "../utils";

const MAX_ALTERNATIVES = 3;
const MAX_CSS_VARS = 2;

/** Known pseudo-state suffixes to strip from selectors for DOM queries */
const PSEUDO_STATES = [":hover", ":focus", ":active", ":focus-visible", ":focus-within"] as const;

/** Strip pseudo-state suffix from a selector for DOM querying */
export function stripPseudoState(selector: string): string {
  for (const pseudo of PSEUDO_STATES) {
    if (selector.endsWith(pseudo)) {
      return selector.slice(0, -pseudo.length);
    }
  }
  return selector;
}

/**
 * Resolve candidates for a single property change.
 */
function resolvePropertyCandidates(
  prop: PropertyChange,
  tokenMap: TokenMap,
  element: Element | null,
): EnrichedPropertyChange {
  const kebab = camelToKebab(prop.property);
  const registry = getTokenRegistry();

  // --- Recommended candidate (exact match) ---
  let recommended: PropertyCandidate | undefined;

  // 1. Check utility class tokens (exact + fuzzy match)
  const utilToken = findTokenForValue(kebab, prop.to);
  if (utilToken) {
    const tokenVal = utilToken.values[kebab] || "";
    const normalizedToken = tokenVal.trim().toLowerCase();
    const normalizedTarget = prop.to.trim().toLowerCase();
    const isExact = normalizedToken === normalizedTarget;
    const candidateType = isRawUtility(utilToken) ? "utility-class" as const : "semantic-token" as const;
    recommended = {
      type: candidateType,
      name: utilToken.className,
      value: tokenVal,
      exact: isExact,
      distance: isExact ? undefined : `nearest: ${tokenVal} vs ${prop.to}`,
    };
  }

  // 2. CSS custom properties
  const cssVarMatches = findCssVarsForValue(prop.to, tokenMap);
  const cssVariables = cssVarMatches.slice(0, MAX_CSS_VARS);

  // If no utility token but we have a CSS variable, promote it to recommended
  if (!recommended && cssVariables.length > 0) {
    recommended = {
      type: "css-variable",
      name: `var(${cssVariables[0]})`,
      value: prop.to,
      exact: true,
    };
  }

  // --- Alternative tokens (semantic only, same category, max 3) ---
  const alternatives: PropertyCandidate[] = [];
  const altTokens = getAlternativeTokens(kebab, utilToken || undefined);
  for (const alt of altTokens) {
    if (alternatives.length >= MAX_ALTERNATIVES) break;
    const altVal = alt.values[kebab];
    if (!altVal) continue;
    // Skip if same as recommended
    if (recommended && alt.className === recommended.name) continue;
    alternatives.push({
      type: isRawUtility(alt) ? "utility-class" : "semantic-token",
      name: alt.className,
      value: altVal,
      exact: altVal.trim().toLowerCase() === prop.to.trim().toLowerCase(),
    });
  }

  // --- Style source resolution ---
  let source: EnrichedPropertyChange["source"];
  let conflicts: EnrichedPropertyChange["conflicts"];

  if (element) {
    try {
      const sources = findStyleSources(element, [prop.property]);
      const propSources = sources.get(prop.property) || [];
      if (propSources.length > 0) {
        const winner = propSources[0];
        source = {
          selector: winner.selector,
          origin: winner.origin,
          stylesheet: winner.stylesheet,
          important: winner.important,
          mediaQuery: winner.mediaQuery,
        };

        // Competing rules that also set this property
        if (propSources.length > 1) {
          conflicts = propSources.slice(1, 4).map(s => ({
            selector: s.selector,
            value: s.value,
            important: s.important,
          }));
        }
      }
    } catch {
      // DOM query failed — leave source/conflicts undefined
    }
  }

  return {
    ...prop,
    recommended,
    alternatives,
    cssVariables,
    source,
    conflicts,
  };
}

/**
 * Enrich all property changes for an element.
 */
export function enrichPropertyChanges(
  changes: PropertyChange[],
  tokenMap: TokenMap,
  selector: string,
): EnrichedPropertyChange[] {
  // Resolve the DOM element once for all properties
  let element: Element | null = null;
  try {
    const baseSelector = stripPseudoState(selector);
    element = document.querySelector(baseSelector);
  } catch {
    // Invalid selector
  }

  return changes.map(c => resolvePropertyCandidates(c, tokenMap, element));
}

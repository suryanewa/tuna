/**
 * Token Registry — scans stylesheets to discover utility class tokens
 * and groups them by property category (spacing, colors, typography, etc.).
 */

import type { TokenRegistry, UtilityToken, TokenCategory, CssFramework } from "./types";
import { getCategoryForProperty } from "./categories";
import {
  countAuthoredProperties,
  isSimpleClassSelector,
  scoreNamePattern,
} from "../selector/identifier";

/** Maximum authored properties for a rule to be considered a utility token */
const MAX_UTILITY_PROPS = 3;

/** Cache: avoid rebuilding when stylesheets haven't changed */
let cachedRegistry: TokenRegistry | null = null;
let cachedSheetCount = -1;

/** Build or return cached token registry by scanning all accessible stylesheets */
export function getTokenRegistry(): TokenRegistry {
  const sheetCount = document.styleSheets.length;
  if (cachedRegistry && cachedSheetCount === sheetCount) return cachedRegistry;

  cachedRegistry = buildRegistry();
  cachedSheetCount = sheetCount;
  return cachedRegistry;
}

/** Force rebuild on next call (e.g., after dynamic style injection) */
export function invalidateTokenRegistry(): void {
  cachedRegistry = null;
  cachedSheetCount = -1;
}

/** Check if the project uses Tailwind CSS */
export function isTailwind(): boolean {
  return getTokenRegistry().framework === "tailwind";
}

function buildRegistry(): TokenRegistry {
  const groups = new Map<TokenCategory, UtilityToken[]>();
  const valueLookup = new Map<string, UtilityToken[]>();
  const classLookup = new Map<string, UtilityToken>();

  // Hidden element for resolving computed values of CSS variables
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:-9999px;left:-9999px;visibility:hidden;pointer-events:none;";
  document.body.appendChild(probe);

  let hasTwVars = false;
  try {
    for (const sheet of document.styleSheets) {
      let rules: CSSRuleList;
      try { rules = sheet.cssRules; } catch { continue; }
      if (!hasTwVars) hasTwVars = detectTailwindVars(rules);
      scanRules(rules, probe, groups, valueLookup, classLookup, undefined);
    }
  } finally {
    probe.remove();
  }

  // Sort tokens within each group by resolved value for logical ordering
  for (const [category, tokens] of groups) {
    groups.set(category, sortTokens(tokens, category));
  }

  const framework = detectFramework(hasTwVars, classLookup);

  return { groups, valueLookup, classLookup, framework };
}

/** Check if any rules contain Tailwind's --tw-* CSS variables */
function detectTailwindVars(rules: CSSRuleList): boolean {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (rule instanceof CSSGroupingRule ||
        (typeof CSSLayerBlockRule !== "undefined" && rule instanceof CSSLayerBlockRule)) {
      if (detectTailwindVars((rule as CSSGroupingRule).cssRules)) return true;
      continue;
    }
    if (!(rule instanceof CSSStyleRule)) continue;
    for (let j = 0; j < rule.style.length; j++) {
      if (rule.style[j].startsWith("--tw-")) return true;
    }
  }
  return false;
}

/** Determine framework from registry contents */
function detectFramework(hasTwVars: boolean, classLookup: Map<string, UtilityToken>): CssFramework {
  if (hasTwVars) return "tailwind";
  // Heuristic: if many classes follow Tailwind naming patterns
  const twPattern = /^(p|m|w|h|gap|text|bg|border|rounded|shadow|opacity|font|leading|tracking|flex|grid|z|inset|top|right|bottom|left)([xytrbl])?-/;
  let twCount = 0;
  for (const name of classLookup.keys()) {
    if (twPattern.test(name)) twCount++;
  }
  if (twCount > 10) return "tailwind";
  if (classLookup.size > 0) return "custom";
  return "unknown";
}

function scanRules(
  rules: CSSRuleList,
  probe: HTMLDivElement,
  groups: Map<TokenCategory, UtilityToken[]>,
  valueLookup: Map<string, UtilityToken[]>,
  classLookup: Map<string, UtilityToken>,
  layerName: string | undefined,
): void {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];

    // Recurse into @layer, @media, @supports — propagate layer name
    if (rule instanceof CSSGroupingRule ||
        (typeof CSSLayerBlockRule !== "undefined" && rule instanceof CSSLayerBlockRule)) {
      const childLayer = (typeof CSSLayerBlockRule !== "undefined" && rule instanceof CSSLayerBlockRule)
        ? (rule as CSSLayerBlockRule).name || layerName
        : layerName;
      scanRules((rule as CSSGroupingRule).cssRules, probe, groups, valueLookup, classLookup, childLayer);
      continue;
    }

    if (!(rule instanceof CSSStyleRule)) continue;

    // Only simple single-class selectors (no combinators, no compound)
    if (!isSimpleClassSelector(rule.selectorText)) continue;

    // Must have few authored properties (utility-like)
    const propCount = countAuthoredProperties(rule.style);
    if (propCount === 0 || propCount > MAX_UTILITY_PROPS) continue;

    // Extract class name from selector
    const classMatch = rule.selectorText.match(/\.([a-zA-Z0-9_-]+)/);
    if (!classMatch) continue;
    const className = classMatch[1];

    // Score the class name — skip obvious semantic/component classes (BEM, etc.)
    // Use a low threshold: structural checks (simple selector + few properties)
    // are the main filter. This only rejects clearly non-token names.
    const { score } = scoreNamePattern(className);
    if (score < 0.20) continue;

    // Already registered (earlier rule takes precedence)
    if (classLookup.has(className)) continue;

    // Extract property values, resolving CSS variables via the probe element.
    // Store ALL longhands (e.g., padding-top, padding-right, etc.) so the
    // resolver can match any individual property. Family dedup is only used
    // for the property count check above, not here.
    const values: Record<string, string> = {};

    for (let j = 0; j < rule.style.length; j++) {
      const prop = rule.style[j];
      if (prop.startsWith("--")) continue;

      // Get the value, resolving CSS variables through the probe
      let val = rule.style.getPropertyValue(prop).trim();
      if (val.includes("var(")) {
        probe.style.cssText = `position:fixed;top:-9999px;left:-9999px;visibility:hidden;pointer-events:none;`;
        probe.style.setProperty(prop, val);
        val = getComputedStyle(probe).getPropertyValue(prop).trim();
        probe.style.removeProperty(prop);
      }
      if (val) values[prop] = val;
    }

    if (Object.keys(values).length === 0) continue;

    // Determine category — all properties must belong to the same category.
    // Multi-category classes (e.g., font-size + color) are component styles, not tokens.
    let category: TokenCategory | null = null;
    let multiCategory = false;
    for (const prop of Object.keys(values)) {
      const cat = getCategoryForProperty(prop);
      if (!cat) continue;
      if (!category) { category = cat; }
      else if (cat !== category) { multiCategory = true; break; }
    }
    if (!category || multiCategory) continue;

    const token: UtilityToken = { className, values, layerName };
    classLookup.set(className, token);

    // Add to category group
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push(token);

    // Add to reverse lookup (property:value → tokens)
    for (const [prop, val] of Object.entries(values)) {
      const key = `${prop}:${val}`;
      if (!valueLookup.has(key)) valueLookup.set(key, []);
      valueLookup.get(key)!.push(token);
    }
  }
}

/** Sort tokens within a category for logical picker ordering */
function sortTokens(tokens: UtilityToken[], category: TokenCategory): UtilityToken[] {
  if (category === "colors") {
    // Sort by hue (extracted from rgb/hex values)
    return tokens.sort((a, b) => {
      const hueA = extractHue(Object.values(a.values)[0]);
      const hueB = extractHue(Object.values(b.values)[0]);
      return hueA - hueB;
    });
  }

  // For spacing/sizing/typography/borders — sort by numeric value ascending
  return tokens.sort((a, b) => {
    const numA = parseFloat(Object.values(a.values)[0]);
    const numB = parseFloat(Object.values(b.values)[0]);
    if (isNaN(numA) && isNaN(numB)) return a.className.localeCompare(b.className);
    if (isNaN(numA)) return 1;
    if (isNaN(numB)) return -1;
    return numA - numB;
  });
}

/** Extract hue from a CSS color value for sorting */
function extractHue(color: string): number {
  if (!color) return 0;
  // Parse rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!rgbMatch) return 0;
  const r = parseInt(rgbMatch[1]) / 255;
  const g = parseInt(rgbMatch[2]) / 255;
  const b = parseInt(rgbMatch[3]) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return h * 360;
}

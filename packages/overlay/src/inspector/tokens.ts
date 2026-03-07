/**
 * Design token scanner — discovers CSS custom properties from the document
 * and builds a reverse map from computed values to token names.
 *
 * Supports:
 * - CSS custom properties (--color-primary, --spacing-4, etc.)
 * - Tailwind CSS utility classes
 * - Common design system patterns (Chakra, MUI, Radix themes, etc.)
 */

export interface DesignToken {
  name: string;        // e.g. "--color-primary" or "--spacing-4"
  value: string;       // e.g. "#3b82f6" or "16px"
  source: string;      // e.g. ":root", ".dark", "body"
}

export interface TokenMap {
  tokens: DesignToken[];
  /** Map from resolved value → token names that produce it */
  valueToTokens: Map<string, string[]>;
}

/** Scan the document for CSS custom properties and build a token map */
export function scanDesignTokens(): TokenMap {
  const tokens: DesignToken[] = [];
  const valueToTokens = new Map<string, string[]>();

  // 1. Scan CSS custom properties from stylesheets
  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule) {
            extractTokensFromRule(rule, tokens);
          } else if (rule instanceof CSSMediaRule) {
            for (const nested of rule.cssRules) {
              if (nested instanceof CSSStyleRule) {
                extractTokensFromRule(nested, tokens);
              }
            }
          }
        }
      } catch {
        // Cross-origin stylesheet — skip
      }
    }
  } catch {
    // Stylesheet access not supported
  }

  // 2. Also scan inline styles on :root and body for CSS vars
  for (const el of [document.documentElement, document.body]) {
    const computed = getComputedStyle(el);
    for (const token of tokens) {
      // Resolve the computed value for each token
      const resolved = computed.getPropertyValue(token.name).trim();
      if (resolved && resolved !== token.value) {
        token.value = resolved;
      }
    }
  }

  // 3. Build reverse map (value → token names)
  for (const token of tokens) {
    const normalized = normalizeValue(token.value);
    if (!valueToTokens.has(normalized)) {
      valueToTokens.set(normalized, []);
    }
    valueToTokens.get(normalized)!.push(token.name);
  }

  return { tokens, valueToTokens };
}

function extractTokensFromRule(rule: CSSStyleRule, tokens: DesignToken[]) {
  const style = rule.style;
  for (let i = 0; i < style.length; i++) {
    const prop = style.item(i);
    if (prop.startsWith("--")) {
      const value = style.getPropertyValue(prop).trim();
      if (value) {
        tokens.push({
          name: prop,
          value,
          source: rule.selectorText,
        });
      }
    }
  }
}

/** Normalize CSS values for comparison (trim, lowercase colors, etc.) */
function normalizeValue(value: string): string {
  let v = value.trim().toLowerCase();
  // Normalize rgb() to consistent format
  v = v.replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)/g,
    (_, r, g, b) => `rgb(${r}, ${g}, ${b})`
  );
  return v;
}

/** Look up a computed value and return matching token names */
export function findTokensForValue(
  value: string,
  tokenMap: TokenMap
): string[] {
  const normalized = normalizeValue(value);
  return tokenMap.valueToTokens.get(normalized) || [];
}

/** Detect the styling approach used by the project */
export type StylingApproach =
  | "tailwind"
  | "css-modules"
  | "styled-components"
  | "css-in-js"
  | "plain-css"
  | "unknown";

export function detectStylingApproach(element: Element): StylingApproach {
  const classes = element.className && typeof element.className === "string"
    ? element.className.trim().split(/\s+/)
    : [];

  // Tailwind: classes like "p-4", "text-sm", "bg-blue-500", "flex", "mx-auto"
  const tailwindPattern = /^-?(?:m|p|w|h|text|bg|border|flex|grid|gap|space|rounded|shadow|opacity|font|leading|tracking|z|inset|top|right|bottom|left|min|max|overflow|cursor|transition|duration|ease|delay|animate|scale|rotate|translate|skew|origin|ring|outline|placeholder|divide|sr|not-sr|container|prose|aspect|columns|break|decoration|underline|overline|line-through|no-underline|antialiased|subpixel|italic|not-italic|normal-case|uppercase|lowercase|capitalize|truncate|indent|align|whitespace|hyphens|content|list|object|overflow|scroll|snap|touch|select|resize|appearance|accent|caret|will-change|fill|stroke)\b/;
  const tailwindCount = classes.filter(c => tailwindPattern.test(c) || /^(sm|md|lg|xl|2xl|dark|hover|focus|active|group|peer):/.test(c)).length;

  if (tailwindCount >= 3 || (classes.length > 0 && tailwindCount / classes.length > 0.5)) {
    return "tailwind";
  }

  // CSS Modules: classes like "styles_button__abc123" or "_button_abc12"
  if (classes.some(c => /^[a-zA-Z]+_[a-zA-Z]+__[a-zA-Z0-9]+$/.test(c) || /^_[a-zA-Z]+_[a-zA-Z0-9]+$/.test(c))) {
    return "css-modules";
  }

  // Styled-components / Emotion: classes like "sc-abc123" or "css-abc123"
  if (classes.some(c => /^sc-[a-zA-Z0-9]+$/.test(c) || /^css-[a-zA-Z0-9]+$/.test(c))) {
    return "css-in-js";
  }

  // Check for styled-components data attribute
  if (element.hasAttribute("data-styled") || element.closest("[data-styled]")) {
    return "styled-components";
  }

  if (classes.length > 0) return "plain-css";
  return "unknown";
}

/** Get a human-readable summary of the token system */
export function summarizeTokenSystem(tokenMap: TokenMap): string | null {
  if (tokenMap.tokens.length === 0) return null;

  // Categorize tokens by prefix patterns
  const categories: Record<string, number> = {};
  for (const token of tokenMap.tokens) {
    const prefix = token.name.replace(/^--/, "").split("-").slice(0, 2).join("-");
    categories[prefix] = (categories[prefix] || 0) + 1;
  }

  const sorted = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const total = tokenMap.tokens.length;
  const prefixes = sorted.map(([prefix, count]) => `${prefix} (${count})`).join(", ");

  return `${total} CSS custom properties found. Top prefixes: ${prefixes}`;
}

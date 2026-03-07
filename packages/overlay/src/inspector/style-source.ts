/**
 * Style source resolver — traces where a computed CSS property value
 * actually comes from (which rule, which stylesheet, which selector).
 *
 * Uses the CSSOM to walk all stylesheets and find matching rules,
 * ordered by specificity so we can identify the "winning" rule.
 */

export interface StyleSource {
  /** The CSS property name (kebab-case) */
  property: string;
  /** The value as authored in the rule */
  value: string;
  /** The CSS selector that matched */
  selector: string;
  /** Where the style comes from */
  origin: "inline" | "stylesheet" | "user-agent";
  /** Stylesheet href or identifier */
  stylesheet?: string;
  /** Whether the rule uses !important */
  important: boolean;
  /** Media query context if any */
  mediaQuery?: string;
}

/**
 * Find where a specific CSS property value comes from for an element.
 * Returns all matching rules sorted by specificity (highest first).
 */
export function findStyleSources(
  element: Element,
  properties: string[]
): Map<string, StyleSource[]> {
  const result = new Map<string, StyleSource[]>();
  for (const prop of properties) {
    result.set(prop, []);
  }

  // Check inline styles first
  const inlineStyle = (element as HTMLElement).style;
  if (inlineStyle) {
    for (const prop of properties) {
      const kebab = camelToKebab(prop);
      const value = inlineStyle.getPropertyValue(kebab);
      if (value) {
        result.get(prop)!.push({
          property: kebab,
          value: value.trim(),
          selector: "[inline]",
          origin: "inline",
          important: inlineStyle.getPropertyPriority(kebab) === "important",
        });
      }
    }
  }

  // Walk all stylesheets
  for (const sheet of document.styleSheets) {
    try {
      const href = sheet.href || sheet.ownerNode?.textContent?.slice(0, 50) || "embedded";
      walkRules(sheet.cssRules, element, properties, result, formatSheetName(href));
    } catch {
      // Cross-origin stylesheet — skip
    }
  }

  // Sort each property's sources by priority (inline > important > specificity)
  for (const [, sources] of result) {
    sources.sort((a, b) => {
      // Inline always wins (unless !important in stylesheet)
      if (a.origin === "inline" && b.origin !== "inline") return -1;
      if (b.origin === "inline" && a.origin !== "inline") return 1;
      // !important wins
      if (a.important && !b.important) return -1;
      if (b.important && !a.important) return 1;
      return 0;
    });
  }

  return result;
}

function walkRules(
  rules: CSSRuleList,
  element: Element,
  properties: string[],
  result: Map<string, StyleSource[]>,
  sheetName: string,
  mediaQuery?: string,
) {
  for (const rule of rules) {
    if (rule instanceof CSSMediaRule) {
      // Recurse into media queries
      walkRules(rule.cssRules, element, properties, result, sheetName, rule.conditionText);
    } else if (rule instanceof CSSStyleRule) {
      // Check if this rule matches the element
      try {
        if (!element.matches(rule.selectorText)) continue;
      } catch {
        continue; // Invalid selector
      }

      const style = rule.style;
      for (const prop of properties) {
        const kebab = camelToKebab(prop);
        const value = style.getPropertyValue(kebab);
        if (value) {
          const source: StyleSource = {
            property: kebab,
            value: value.trim(),
            selector: rule.selectorText,
            origin: "stylesheet",
            stylesheet: sheetName,
            important: style.getPropertyPriority(kebab) === "important",
          };
          if (mediaQuery) {
            source.mediaQuery = mediaQuery;
          }
          result.get(prop)!.push(source);
        }
      }
    }
  }
}

/** Format a stylesheet name for display */
function formatSheetName(href: string): string {
  if (href === "embedded") return "embedded <style>";
  try {
    const url = new URL(href);
    // Return just the pathname, trimmed
    const path = url.pathname;
    // Remove common prefixes
    return path.replace(/^\/_next\/static\/css\//, "").replace(/^\//, "");
  } catch {
    return href.slice(0, 80);
  }
}

function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/**
 * Format style sources as a concise string for the output.
 * Shows the winning rule's source.
 */
export function formatStyleSource(sources: StyleSource[]): string {
  if (sources.length === 0) return "unknown";

  const winner = sources[0];

  if (winner.origin === "inline") {
    return "inline style";
  }

  let result = `\`${winner.selector}\``;
  if (winner.stylesheet) {
    result += ` in \`${winner.stylesheet}\``;
  }
  if (winner.mediaQuery) {
    result += ` @media(${winner.mediaQuery})`;
  }
  if (winner.important) {
    result += " !important";
  }

  return result;
}

/**
 * Format element changes as structured context for AI agents.
 *
 * Outputs rich, forensic-level detail including:
 * - Source file location (React _debugSource)
 * - Styling approach detection (Tailwind, CSS modules, etc.)
 * - Design token mapping (CSS custom properties → values)
 * - Component hierarchy and props context
 * - Before/after values with token suggestions
 */

import type { ElementChange, EnrichedPropertyChange } from "../types";
import { type TokenMap, scanDesignTokens, summarizeTokenSystem } from "../inspector/tokens";
import { camelToKebab, truncate } from "../utils";
import { getTokenRegistry } from "../tokens/registry";
import { enrichPropertyChanges } from "./candidates";

export type Fidelity = "minimal" | "standard" | "full";

/** Known pseudo-state suffixes that we extract from selectors */
const PSEUDO_STATES = [":hover", ":focus", ":active", ":focus-visible", ":focus-within"] as const;

interface ParsedSelector {
  /** The base selector without pseudo-state (e.g. ".btn") */
  base: string;
  /** The pseudo-state if present (e.g. "hover") */
  pseudoState: string | null;
}

/** Extract pseudo-state suffix from a selector, e.g. ".btn:hover" -> { base: ".btn", pseudoState: "hover" } */
export function parsePseudoState(selector: string): ParsedSelector {
  for (const pseudo of PSEUDO_STATES) {
    if (selector.endsWith(pseudo)) {
      return {
        base: selector.slice(0, -pseudo.length),
        pseudoState: pseudo.slice(1), // remove the leading ":"
      };
    }
  }
  return { base: selector, pseudoState: null };
}

/** Describe the scope of a selector for AI agent context */
export function describeSelectorScope(selector: string): string | null {
  // Strip pseudo-state first for scope analysis
  const { base } = parsePseudoState(selector);

  // Class-based selectors: start with "." (may include combinators like ".card .title")
  if (base.startsWith(".")) {
    try {
      const count = document.querySelectorAll(base).length;
      if (count > 0) {
        return `class-scoped, ${count} element${count > 1 ? "s" : ""}`;
      }
    } catch {
      // Invalid selector for querySelectorAll — fall through
    }
    return "class-scoped";
  }

  // ID-based selectors
  if (base.startsWith("#")) {
    return "id-scoped, unique";
  }

  // Path selectors (contain ">") or other complex selectors are element-specific
  if (base.includes(">")) {
    return "element-specific";
  }

  return null;
}

let cachedTokenMap: TokenMap | null = null;

function getTokenMap(): TokenMap {
  if (!cachedTokenMap) {
    cachedTokenMap = scanDesignTokens();
  }
  return cachedTokenMap;
}

export function formatChanges(changes: ElementChange[], fidelity: Fidelity): string {
  if (changes.length === 0) return "No changes recorded.";

  const tokenMap = getTokenMap();
  const lines: string[] = [];

  // Header
  lines.push(`# Visual Changes (${changes.length} element${changes.length > 1 ? "s" : ""})`);
  lines.push("");

  // Environment context
  lines.push("**Environment:**");
  lines.push(`- URL: ${window.location.href}`);
  lines.push(`- Viewport: ${window.innerWidth}×${window.innerHeight}`);
  lines.push(`- Device Pixel Ratio: ${window.devicePixelRatio}`);
  lines.push(`- Timestamp: ${new Date().toISOString()}`);
  lines.push("");

  // Token system summary (if tokens exist)
  if (fidelity !== "minimal") {
    const tokenSummary = summarizeTokenSystem(tokenMap);
    if (tokenSummary) {
      lines.push(`> **Design tokens detected:** ${tokenSummary}`);
      lines.push("");
    }
  }

  // Framework detection guidance
  const registry = getTokenRegistry();
  if (registry.framework === "tailwind") {
    lines.push("> **Framework:** Tailwind CSS detected. Apply all changes using Tailwind utility classes — do NOT use inline styles or raw CSS values. When a class swap is suggested, replace the old class with the new one in the JSX/HTML.");
    lines.push("");
  }

  // Each element change
  const sections = changes.map((change) => formatSingleChange(change, fidelity, tokenMap));
  lines.push(sections.join("\n---\n\n"));

  return lines.join("\n");
}

function formatSingleChange(change: ElementChange, fidelity: Fidelity, tokenMap: TokenMap): string {
  const lines: string[] = [];

  // Element identification
  lines.push(`## \`<${change.tagName.toLowerCase()}>\`${change.textContent ? ` "${truncate(change.textContent, 60)}"` : ""}`);
  lines.push("");

  // Source file (most important for agents to find the code)
  if (change.sourceFile) {
    const col = change.sourceFile.columnNumber ? `:${change.sourceFile.columnNumber}` : "";
    lines.push(`**Source:** \`${change.sourceFile.fileName}:${change.sourceFile.lineNumber}${col}\``);
  }

  // Component hierarchy
  if (change.reactComponents.length > 0) {
    lines.push(`**Component:** ${change.reactComponents.join(" → ")}`);
  }

  // Styling approach
  if (change.stylingApproach && change.stylingApproach !== "unknown") {
    lines.push(`**Styling:** ${formatStylingApproach(change.stylingApproach)}`);
  }

  // DOM path (full traversal for precise identification)
  if (fidelity !== "minimal" && change.domPath) {
    lines.push(`**DOM Path:** \`${change.domPath}\``);
  }

  // Selector — extract pseudo-state and add scope context
  const { base: baseSelector, pseudoState } = parsePseudoState(change.selector);
  const selectorAnnotations: string[] = [];
  if (pseudoState) {
    selectorAnnotations.push(`${pseudoState} state`);
  }
  const scope = describeSelectorScope(change.selector);
  if (scope) {
    selectorAnnotations.push(scope);
  }
  const selectorSuffix = selectorAnnotations.length > 0
    ? ` (${selectorAnnotations.join(", ")})`
    : "";
  lines.push(`**Selector:** \`${baseSelector}\`${selectorSuffix}`);

  // Element ID
  if (fidelity === "full" && change.elementId) {
    lines.push(`**ID:** \`${change.elementId}\``);
  }

  // Accessible name (aria-label, alt, title, etc.)
  if (fidelity === "full" && change.accessibleName) {
    lines.push(`**Accessible name:** "${change.accessibleName}"`);
  }

  // Classes (always include when present — agents need this)
  if (change.classes.length > 0) {
    lines.push(`**Classes:** \`${change.classes.join(" ")}\``);
  }

  // Position and dimensions
  if (fidelity === "full" && change.position) {
    lines.push(`**Position:** x:${change.position.x}, y:${change.position.y} (${change.position.width}×${change.position.height}px)`);
  }

  // Nearby siblings for context
  if (fidelity === "full" && change.nearbySiblings) {
    lines.push(`**Nearby elements:** ${change.nearbySiblings}`);
  }

  // Parent context for disambiguation
  if (fidelity === "full" && change.parentContext) {
    lines.push(`**Parent:** \`${change.parentContext}\``);
  }

  // Child summary to help identify container elements
  if (fidelity === "full" && change.childSummary) {
    lines.push(`**Children:** ${change.childSummary}`);
  }

  // Inline styles (if any authored inline styles exist)
  if (fidelity === "full" && change.inlineStyles) {
    lines.push(`**Inline styles:** \`${change.inlineStyles}\``);
  }

  // Collapse longhand groups into shorthands where possible
  const collapsed = collapseShorthands(change.changes);

  // Enrich each property with candidate tokens/classes/variables and source info
  const enriched = enrichPropertyChanges(collapsed, tokenMap, change.selector);

  // Changes table
  lines.push("");
  lines.push("### Changes");
  lines.push("");
  lines.push("| Property | Before | After | Source | Token |");
  lines.push("|----------|--------|-------|--------|-------|");

  for (const prop of enriched) {
    const kebab = camelToKebab(prop.property);
    const tokenStr = formatRecommended(prop);
    const sourceStr = formatEnrichedSource(prop);
    lines.push(`| \`${kebab}\` | \`${prop.from}\` | \`${prop.to}\` | ${sourceStr} | ${tokenStr} |`);
  }

  // Resolution context (detail blocks) — standard + full fidelity only
  if (fidelity !== "minimal") {
    const detailLines = formatResolutionContext(enriched);
    if (detailLines) {
      lines.push("");
      lines.push(detailLines);
    }
  }

  lines.push("");
  return lines.join("\n");
}

function formatStylingApproach(approach: string): string {
  switch (approach) {
    case "tailwind": return "Tailwind CSS (modify utility classes)";
    case "css-modules": return "CSS Modules (modify `.module.css` file)";
    case "css-in-js": return "CSS-in-JS / Emotion (modify style object)";
    case "styled-components": return "styled-components (modify template literal)";
    case "plain-css": return "Plain CSS (modify stylesheet)";
    default: return approach;
  }
}

/** Format the recommended candidate for the Token column */
function formatRecommended(prop: EnrichedPropertyChange): string {
  if (!prop.recommended) return "—";
  const r = prop.recommended;
  const name = r.type === "css-variable" ? `\`${r.name}\`` : `\`.${r.name}\``;
  if (!r.exact && r.distance) {
    return `${name} (${r.distance})`;
  }
  return name;
}

/** Format the source column from enriched data */
function formatEnrichedSource(prop: EnrichedPropertyChange): string {
  if (!prop.source) return "—";
  const s = prop.source;
  if (s.origin === "inline") return "inline style";
  let result = `\`${s.selector}\``;
  if (s.stylesheet) result += ` in \`${s.stylesheet}\``;
  if (s.mediaQuery) result += ` @media(${s.mediaQuery})`;
  if (s.important) result += " !important";
  return result;
}

/** Build the resolution context detail block for properties that have meaningful context */
function formatResolutionContext(enriched: EnrichedPropertyChange[]): string | null {
  const entries: string[] = [];

  for (const prop of enriched) {
    const hasAlternatives = prop.alternatives.length > 0;
    const hasCssVars = prop.cssVariables.length > 0;
    const hasConflicts = prop.conflicts && prop.conflicts.length > 0;
    // Only include if there's something beyond what the table shows
    if (!hasAlternatives && !hasCssVars && !hasConflicts) continue;

    const kebab = camelToKebab(prop.property);
    const lines: string[] = [];
    lines.push(`**\`${kebab}\`** \`${prop.from}\` → \`${prop.to}\``);

    if (prop.recommended) {
      const r = prop.recommended;
      const label = r.exact ? "exact" : r.distance || "fuzzy";
      lines.push(`- Recommended: \`.${r.type === "css-variable" ? r.name : r.name}\` (${label}, \`${r.value}\`)`);
    }

    if (hasAlternatives) {
      const altStr = prop.alternatives.map(a => `\`.${a.name}\` (\`${a.value}\`)`).join(", ");
      lines.push(`- Alternatives: ${altStr}`);
    }

    if (hasCssVars) {
      const varStr = prop.cssVariables.map(v => `\`var(${v})\``).join(", ");
      lines.push(`- CSS vars: ${varStr}`);
    }

    if (hasConflicts) {
      for (const c of prop.conflicts!) {
        const imp = c.important ? ", !important" : "";
        lines.push(`- Competing rule: \`${c.selector}\` (\`${c.value}\`${imp})`);
      }
    }

    entries.push(lines.join("\n"));
  }

  if (entries.length === 0) return null;

  return `<details>\n<summary>Resolution context</summary>\n\n${entries.join("\n\n")}\n\n</details>`;
}

/** Shorthand groups: when all longhands share the same "to" value, collapse into one shorthand */
const SHORTHAND_GROUPS: Array<{ shorthand: string; longhands: string[] }> = [
  {
    shorthand: "borderRadius",
    longhands: ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius"],
  },
  {
    shorthand: "padding",
    longhands: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
  },
  {
    shorthand: "margin",
    longhands: ["marginTop", "marginRight", "marginBottom", "marginLeft"],
  },
  {
    shorthand: "borderWidth",
    longhands: ["borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"],
  },
  {
    shorthand: "borderColor",
    longhands: ["borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"],
  },
  {
    shorthand: "borderStyle",
    longhands: ["borderTopStyle", "borderRightStyle", "borderBottomStyle", "borderLeftStyle"],
  },
];

export function collapseShorthands(changes: import("../types").PropertyChange[]): import("../types").PropertyChange[] {
  const result = [...changes];
  for (const group of SHORTHAND_GROUPS) {
    const matches = group.longhands.map((lh) => result.find((c) => c.property === lh));
    if (matches.every((m) => m != null)) {
      const allSameTo = new Set(matches.map((m) => m!.to)).size === 1;
      const allSameFrom = new Set(matches.map((m) => m!.from)).size === 1;
      if (allSameTo && allSameFrom) {
        // Remove longhands, add shorthand
        for (const lh of group.longhands) {
          const idx = result.findIndex((c) => c.property === lh);
          if (idx !== -1) result.splice(idx, 1);
        }
        result.push({ property: group.shorthand, from: matches[0]!.from, to: matches[0]!.to });
      }
    }
  }
  return result;
}


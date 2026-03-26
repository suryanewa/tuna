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
import { getVariableRegistry } from "../variables/registry";
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

  // Header — preamble gives the AI model clear intent + identification
  lines.push("Apply these Retune visual changes to the source code:\n");
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
  const registry = getVariableRegistry();
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

  // For compound selectors (.btn.btn-ghost), break down the class chain
  // so the AI knows which classes to look for in the source code
  const compoundClasses = baseSelector.match(/\.[a-zA-Z0-9_-]+/g);
  if (compoundClasses && compoundClasses.length > 1) {
    const classBreakdown = compoundClasses.map(c => {
      const cls = c.slice(1); // strip leading dot
      try {
        const count = document.querySelectorAll(c).length;
        return `\`.${cls}\` (${count})`;
      } catch { return `\`.${cls}\``; }
    });
    lines.push(`**Target classes:** ${classBreakdown.join(" → ")} — apply changes where all these classes are present`);
  }

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

  // Check for element deletion
  const isDelete = change.changes.some(c => c.property === "__delete");
  if (isDelete) {
    lines.push("");
    lines.push("### Action: Delete Element");
    lines.push("");
    lines.push("Remove this element from the source code entirely.");
    if (change.classes.length > 0) {
      lines.push(`**Classes:** \`${change.classes.join(" ")}\``);
    }
    lines.push("");
    return lines.join("\n");
  }

  // Check for reparent
  const reparentChange = change.changes.find(c => c.property === "__reparent");
  if (reparentChange) {
    // Parse "selector@index" format — use lastIndexOf to handle selectors with special chars
    const fromAtIdx = reparentChange.from.lastIndexOf("@");
    const fromSelector = fromAtIdx !== -1 ? reparentChange.from.slice(0, fromAtIdx) : reparentChange.from;
    const toAtIdx = reparentChange.to.lastIndexOf("@");
    const toSelector = toAtIdx !== -1 ? reparentChange.to.slice(0, toAtIdx) : reparentChange.to;
    const toIndex = toAtIdx !== -1 ? reparentChange.to.slice(toAtIdx + 1) : "0";
    lines.push("");
    lines.push("### Action: Reparent Element");
    lines.push("");
    lines.push("Move this element from its current parent to a new parent container.");
    lines.push(`**From:** \`${fromSelector}\``);
    lines.push(`**To:** \`${toSelector}\` (as child at position ${toIndex})`);
    lines.push("");
    return lines.join("\n");
  }

  // Check for reorder
  const reorderChange = change.changes.find(c => c.property === "__reorder");
  if (reorderChange) {
    lines.push("");
    lines.push("### Action: Reorder Element");
    lines.push("");
    lines.push(`Moved from position ${reorderChange.from} to position ${reorderChange.to} within its parent container.`);
    lines.push("");
  }

  // Check for text content change
  const textChange = change.changes.find(c => c.property === "__text");
  if (textChange) {
    lines.push("");
    lines.push("### Action: Edit Text Content");
    lines.push("");
    lines.push("| Before | After |");
    lines.push("|--------|-------|");
    lines.push(`| ${truncate(textChange.from, 60)} | ${truncate(textChange.to, 60)} |`);
    lines.push("");
  }

  // Collapse longhand groups into shorthands where possible
  const collapsed = collapseShorthands(change.changes);

  // Enrich each property with candidate tokens/classes/variables and source info
  const enriched = enrichPropertyChanges(collapsed, tokenMap, change.selector);

  // Override recommended with user's explicit token choice (from token picker)
  if (change.variableAssociations) {
    for (const prop of enriched) {
      const camelProp = prop.property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      const assoc = change.variableAssociations[camelProp];
      if (assoc) {
        const isVar = assoc.className.startsWith("var(");
        prop.recommended = {
          type: isVar ? "css-variable" : "semantic-token",
          name: assoc.className,
          value: Object.values(assoc.values)[0] || prop.to,
          exact: true,
        };
      }
    }
  }

  // Changes table — only render if there are value changes
  if (enriched.length > 0) {
    lines.push("");
    lines.push("### Changes");
    lines.push("");
    lines.push("| Property | Before | After | Token |");
    lines.push("|----------|--------|-------|-------|");

    for (const prop of enriched) {
      // Class swap properties use "class:oldName" format — don't camelToKebab those
      const kebab = prop.property.startsWith("class:") ? prop.property : camelToKebab(prop.property);
      const tokenStr = formatRecommended(prop);
      lines.push(`| \`${kebab}\` | \`${prop.from}\` | \`${prop.to}\` | ${tokenStr} |`);
    }
  }

  // Detached variables — properties where the user explicitly removed a token/variable binding
  if (change.unlinkedProperties && change.unlinkedProperties.length > 0) {
    lines.push("");
    lines.push("### Detached Variables");
    lines.push("");
    lines.push("The following properties had their design token/variable binding removed. Hardcode the current values — do not use the token class or CSS variable:");
    lines.push("");
    lines.push("| Property | Current Value |");
    lines.push("|----------|---------------|");
    for (const { property, value } of change.unlinkedProperties) {
      const kebab = camelToKebab(property);
      lines.push(`| \`${kebab}\` | \`${value}\` |`);
    }
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
      const nameStr = r.type === "css-variable" ? `\`${r.name}\`` : `\`.${r.name}\``;
      lines.push(`- Recommended: ${nameStr} (${label}, \`${r.value}\`)`);
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


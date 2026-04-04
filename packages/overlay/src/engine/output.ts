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
import type { Comment } from "./comment-store";

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

  // Ancestor-scoped selectors: contain descendant combinator (space between class parts)
  // e.g. ".message-row--unread .message-row__subject"
  const noParen = base.replace(/\([^)]*\)/g, ""); // ignore spaces inside pseudo-functions
  // Match descendant/child combinators between any selector parts (classes, attributes, pseudo-functions)
  const hasDescendant = /[.\])\w]\s+[.\[:]/.test(noParen);
  const hasChild = /[.\])\w]\s*>\s*[.\[:]/.test(noParen);

  if (base.startsWith(".") || base.startsWith(":") || base.startsWith("[")) {
    try {
      const count = document.querySelectorAll(base).length;
      const countStr = count > 0 ? `, ${count} element${count > 1 ? "s" : ""}` : "";
      if (hasDescendant || hasChild) {
        return `ancestor-scoped${countStr}`;
      }
      if (count > 0) {
        return `class-scoped${countStr}`;
      }
    } catch {
      // Invalid selector for querySelectorAll — fall through
    }
    if (hasDescendant || hasChild) return "ancestor-scoped";
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

export function formatChanges(changes: ElementChange[], fidelity: Fidelity, comments?: Comment[], manifest?: Record<string, any> | null): string {
  if (changes.length === 0 && (!comments || comments.length === 0)) return "No changes recorded.";

  // Separate bulk instances from primary changes
  const bulkCount = changes.filter(c => c.changes.some(p => p.property === "__bulkOf")).length;
  const primaryChanges = changes.filter(c => !c.changes.some(p => p.property === "__bulkOf"));
  // Use primary changes for output; add bulk count to structural actions
  changes = primaryChanges;

  const tokenMap = getTokenMap();
  const lines: string[] = [];

  // Header — preamble gives the AI model clear intent + identification
  const hasChanges = changes.length > 0;
  const hasComments = comments && comments.length > 0;
  if (hasChanges && hasComments) {
    lines.push("Apply these Retune visual changes and address the user's comments in the source code:\n");
  } else if (hasComments) {
    lines.push("The user has left comments on their running app using Retune. Address each comment by making the described changes to the source code:\n");
  } else {
    lines.push("Apply these Retune visual changes to the source code:\n");
  }
  // Environment context
  lines.push("**Environment:**");
  lines.push(`- URL: ${window.location.href}`);
  lines.push(`- Viewport: ${window.innerWidth}×${window.innerHeight}`);
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

  // Manifest context — gives AI agent knowledge of the project's component system
  if (manifest?.components && fidelity !== "minimal") {
    const componentNames = Object.keys(manifest.components);
    if (componentNames.length > 0) {
      lines.push(`> **Manifest:** ${componentNames.length} components defined (${componentNames.join(", ")}). Prop types, enum values, and class mappings are available in \`retune.manifest.json\`.`);
      lines.push("");
    }
  }

  // Each element change — only show section if there are changes
  if (changes.length > 0) {
    lines.push(`# Visual Changes (${changes.length} element${changes.length !== 1 ? "s" : ""})`);
    lines.push("");
    const sections = changes.map((change) => formatSingleChange(change, fidelity, tokenMap, bulkCount, manifest));
    lines.push(sections.join("\n---\n\n"));
  }

  // Comments section
  if (comments && comments.length > 0) {
    if (changes.length > 0) {
      lines.push("");
      lines.push("---");
      lines.push("");
    }
    lines.push(`# Comments (${comments.length})`);
    lines.push("");
    comments.forEach((comment, idx) => {
      if (comment.type === "element" && comment.elementInfo) {
        const info = comment.elementInfo;
        const textHint = info.textContent ? ` "${truncate(info.textContent, 60)}"` : "";
        lines.push(`## Comment #${idx + 1} on \`<${info.tagName}>\`${textHint}`);
        lines.push("");
        if (info.componentName) {
          lines.push(`**Component:** ${info.componentName}`);
        }
        if (comment.selector) {
          lines.push(`**Selector:** \`${comment.selector}\``);
        }
        if (info.classes.length > 0) {
          lines.push(`**Classes:** \`${info.classes.join(" ")}\``);
        }
        lines.push(`**Marker position:** (${Math.round(comment.position.x)}, ${Math.round(comment.position.y)}) on viewport`);
      } else if (comment.type === "area" && comment.area) {
        const a = comment.area;
        lines.push(`## Comment #${idx + 1} on area`);
        lines.push("");
        lines.push(`**Region:** (${Math.round(a.x)}, ${Math.round(a.y)}) ${Math.round(a.width)}×${Math.round(a.height)}px`);
        const contained = comment.elementInfo?.containedElements;
        if (contained && contained.length > 0) {
          const items = contained.slice(0, 8).map(el => {
            const text = el.textContent ? ` "${truncate(el.textContent, 30)}"` : "";
            const comp = el.componentName ? ` (${el.componentName})` : "";
            return `\`<${el.tagName}>\` ${el.selector}${text}${comp}`;
          });
          lines.push(`**Contains:** ${items.join(", ")}`);
        }
      } else {
        lines.push(`## Comment #${idx + 1}`);
      }
      lines.push("");
      lines.push(`> ${comment.text.split("\n").join("\n> ")}`);
      lines.push("");
    });
  }

  return lines.join("\n");
}

function formatSingleChange(change: ElementChange, fidelity: Fidelity, tokenMap: TokenMap, bulkInstanceCount = 0, manifest?: Record<string, any> | null): string {
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

    // Per-element manifest context — show component props/class_map for the nearest component
    if (manifest?.components && fidelity !== "minimal") {
      const compName = change.reactComponents[0];
      const compDef = manifest.components[compName];
      if (compDef?.props) {
        const propSummaries: string[] = [];
        for (const [propName, propDef] of Object.entries<any>(compDef.props)) {
          if (propDef.type === "function") continue; // skip callbacks
          let summary = `${propName}: ${propDef.type}`;
          if (propDef.type === "enum" && propDef.values) {
            summary += `(${propDef.values.join(", ")})`;
          }
          if (propDef.default !== undefined) {
            summary += ` = ${JSON.stringify(propDef.default)}`;
          }
          if (propDef.class_map) {
            const mappings = Object.entries(propDef.class_map).map(([v, c]) => `${v}→${c}`).join(", ");
            summary += ` [${mappings}]`;
          }
          propSummaries.push(summary);
        }
        if (propSummaries.length > 0) {
          if (fidelity === "full") {
            lines.push(`**Component props:** ${propSummaries.join("; ")}`);
          } else {
            // Standard: only show enum props with class_map (most useful for the agent)
            const enumProps = propSummaries.filter(s => s.includes("enum") || s.includes("→"));
            if (enumProps.length > 0) {
              lines.push(`**Variants:** ${enumProps.join("; ")}`);
            }
          }
        }
      }
    }
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

  // For compound/ancestor selectors, break down the class chain
  // so the AI knows which classes to look for in the source code
  const noParen = baseSelector.replace(/\([^)]*\)/g, "");
  const isAncestorSelector = /\.[a-zA-Z][\w-]*\s+\.[a-zA-Z]/.test(noParen) || /\.[a-zA-Z][\w-]*\s*>\s*\.[a-zA-Z]/.test(noParen);

  if (isAncestorSelector) {
    // Ancestor compound: ".parent .child" — split into ancestor and element parts
    const parts = baseSelector.split(/\s+(?=[.#\[:])/).filter(Boolean);
    if (parts.length >= 2) {
      const ancestorPart = parts.slice(0, -1).join(" ");
      const elementPart = parts[parts.length - 1];
      lines.push(`**Ancestor context:** \`${ancestorPart}\` — change only applies inside this ancestor`);
      lines.push(`**Target element:** \`${elementPart}\` — the element being styled`);
    }
  } else {
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
    if (bulkInstanceCount > 0) {
      lines.push(`Move this element from its current parent to a new parent container. **This is a component-level change affecting ${bulkInstanceCount + 1} instances** — apply the change to the component JSX template, not individual instances.`);
    } else {
      lines.push("Move this element from its current parent to a new parent container.");
    }
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
    if (bulkInstanceCount > 0) {
      lines.push(`Moved from position ${reorderChange.from} to position ${reorderChange.to} within its parent container. **This is a component-level change affecting ${bulkInstanceCount + 1} instances** — reorder the children in the component JSX template, not individual instances.`);
    } else {
      lines.push(`Moved from position ${reorderChange.from} to position ${reorderChange.to} within its parent container.`);
    }
    lines.push("");
  }

  // Check for text content change
  const textChange = change.changes.find(c => c.property === "__text");
  if (textChange) {
    lines.push("");
    lines.push("### Action: Edit Text Content");
    lines.push("");
    // Show full text content (escape newlines and pipe characters for markdown table)
    const escapeForTable = (s: string) => s.replace(/\n/g, "\\n").replace(/\|/g, "\\|");
    lines.push("**Before:**");
    lines.push("```");
    lines.push(textChange.from);
    lines.push("```");
    lines.push("**After:**");
    lines.push("```");
    lines.push(textChange.to);
    lines.push("```");
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

  // Attribute changes (HTML/SVG attributes — alt, loading, autoplay, fill, stroke, etc.)
  if (change.attributeChanges && change.attributeChanges.length > 0) {
    const isSvgElement = ["SVG", "PATH", "CIRCLE", "ELLIPSE", "RECT", "LINE", "POLYGON", "POLYLINE", "G", "TEXT", "USE", "DEFS"].includes(change.tagName.toUpperCase());
    lines.push("");
    lines.push(isSvgElement ? "### SVG Attribute Changes" : "### Attribute Changes");
    lines.push("");
    lines.push(isSvgElement
      ? "Apply these changes to the SVG element's attributes:"
      : "Apply these changes to the HTML element's attributes:");
    lines.push("");
    lines.push("| Attribute | From | To |");
    lines.push("|-----------|------|----|");
    for (const { attr, from, to } of change.attributeChanges) {
      lines.push(`| \`${attr}\` | \`${from || "—"}\` | \`${to}\` |`);
    }
  }

  // Prop changes (React component prop edits)
  if (change.propChanges && change.propChanges.length > 0) {
    lines.push("");
    lines.push("### Prop Changes");
    lines.push("");
    lines.push("Apply these changes to the JSX where this component is rendered:");
    lines.push("");
    lines.push("| Prop | From | To |");
    lines.push("|------|------|----|");
    for (const { prop, from, to } of change.propChanges) {
      const fromStr = from === undefined ? "—" : JSON.stringify(from);
      const toStr = to === undefined ? "—" : JSON.stringify(to);
      lines.push(`| \`${prop}\` | \`${fromStr}\` | \`${toStr}\` |`);
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


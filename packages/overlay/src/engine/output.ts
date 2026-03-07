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

import type { ElementChange } from "../types";
import { type TokenMap, scanDesignTokens, findTokensForValue, summarizeTokenSystem } from "../inspector/tokens";
import { findStyleSources, formatStyleSource } from "../inspector/style-source";

export type Fidelity = "minimal" | "standard" | "full";

let cachedTokenMap: TokenMap | null = null;

function getTokenMap(): TokenMap {
  if (!cachedTokenMap) {
    cachedTokenMap = scanDesignTokens();
  }
  return cachedTokenMap;
}

/** Invalidate the cached token map (call after DOM changes) */
export function invalidateTokenCache() {
  cachedTokenMap = null;
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
  if (change.domPath) {
    lines.push(`**DOM Path:** \`${change.domPath}\``);
  }

  // Selector
  lines.push(`**Selector:** \`${change.selector}\``);

  // Element ID
  if (change.elementId) {
    lines.push(`**ID:** \`${change.elementId}\``);
  }

  // Accessible name (aria-label, alt, title, etc.)
  if (change.accessibleName) {
    lines.push(`**Accessible name:** "${change.accessibleName}"`);
  }

  // Classes (always include when present — agents need this)
  if (change.classes.length > 0) {
    lines.push(`**Classes:** \`${change.classes.join(" ")}\``);
  }

  // Position and dimensions
  if (change.position) {
    lines.push(`**Position:** x:${change.position.x}, y:${change.position.y} (${change.position.width}×${change.position.height}px)`);
  }

  // Nearby siblings for context
  if (change.nearbySiblings) {
    lines.push(`**Nearby elements:** ${change.nearbySiblings}`);
  }

  // Parent context for disambiguation
  if (change.parentContext) {
    lines.push(`**Parent:** \`${change.parentContext}\``);
  }

  // Child summary to help identify container elements
  if (change.childSummary) {
    lines.push(`**Children:** ${change.childSummary}`);
  }

  // Inline styles (if any authored inline styles exist)
  if (change.inlineStyles) {
    lines.push(`**Inline styles:** \`${change.inlineStyles}\``);
  }

  // Resolve style sources from the live DOM
  const sourceMap = resolveStyleSources(change.selector, change.changes.map(c => c.property));

  // Changes table
  lines.push("");
  lines.push("### Changes");
  lines.push("");
  lines.push("| Property | Before | After | Source | Token |");
  lines.push("|----------|--------|-------|--------|-------|");

  for (const prop of change.changes) {
    const kebab = camelToKebab(prop.property);
    const tokenHint = getTokenHint(prop.to, tokenMap);
    const source = sourceMap.get(prop.property);
    const sourceStr = source ? formatStyleSource(source) : "—";
    lines.push(`| \`${kebab}\` | \`${prop.from}\` | \`${prop.to}\` | ${sourceStr} | ${tokenHint} |`);
  }

  // Implementation hint based on styling approach
  if (fidelity !== "minimal") {
    const hint = getImplementationHint(change);
    if (hint) {
      lines.push("");
      lines.push(`> **Implementation hint:** ${hint}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

/** Resolve style sources for each property from the live DOM */
function resolveStyleSources(
  selector: string,
  properties: string[]
): Map<string, StyleSource[]> {
  try {
    const element = document.querySelector(selector);
    if (!element) return new Map();
    return findStyleSources(element, properties);
  } catch {
    return new Map();
  }
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

function getTokenHint(value: string, tokenMap: TokenMap): string {
  const tokens = findTokensForValue(value, tokenMap);
  if (tokens.length === 0) return "—";
  // Show up to 2 matching tokens
  const display = tokens.slice(0, 2).map(t => `\`var(${t})\``).join(", ");
  return tokens.length > 2 ? `${display} +${tokens.length - 2} more` : display;
}

function getImplementationHint(change: ElementChange): string | null {
  const approach = change.stylingApproach;

  if (approach === "tailwind") {
    const hints: string[] = [];
    for (const prop of change.changes) {
      const tw = suggestTailwindClass(prop.property, prop.to);
      if (tw) hints.push(tw);
    }
    if (hints.length > 0) {
      return `Suggested Tailwind classes: \`${hints.join(" ")}\``;
    }
  }

  if (approach === "css-modules" && change.sourceFile) {
    return `Look for a \`.module.css\` file near \`${change.sourceFile.fileName}\``;
  }

  return null;
}

/** Basic Tailwind class suggestions for common properties */
function suggestTailwindClass(property: string, value: string): string | null {
  const num = parseFloat(value);
  const pxToTw: Record<number, string> = {
    0: "0", 1: "px", 2: "0.5", 4: "1", 6: "1.5", 8: "2", 10: "2.5",
    12: "3", 14: "3.5", 16: "4", 20: "5", 24: "6", 28: "7", 32: "8",
    36: "9", 40: "10", 44: "11", 48: "12", 56: "14", 64: "16",
    80: "20", 96: "24", 112: "28", 128: "32", 144: "36",
    160: "40", 176: "44", 192: "48", 208: "52", 224: "56",
    240: "60", 256: "64", 288: "72", 320: "80", 384: "96",
  };

  const twSize = pxToTw[num];

  switch (property) {
    case "paddingTop": return twSize ? `pt-${twSize}` : null;
    case "paddingRight": return twSize ? `pr-${twSize}` : null;
    case "paddingBottom": return twSize ? `pb-${twSize}` : null;
    case "paddingLeft": return twSize ? `pl-${twSize}` : null;
    case "marginTop": return twSize ? `mt-${twSize}` : null;
    case "marginRight": return twSize ? `mr-${twSize}` : null;
    case "marginBottom": return twSize ? `mb-${twSize}` : null;
    case "marginLeft": return twSize ? `ml-${twSize}` : null;
    case "gap": return twSize ? `gap-${twSize}` : null;
    case "borderRadius":
    case "borderTopLeftRadius":
    case "borderTopRightRadius":
    case "borderBottomLeftRadius":
    case "borderBottomRightRadius": {
      const radiusMap: Record<number, string> = {
        0: "rounded-none", 2: "rounded-sm", 4: "rounded", 6: "rounded-md",
        8: "rounded-lg", 12: "rounded-xl", 16: "rounded-2xl", 24: "rounded-3xl",
      };
      return radiusMap[num] || (value === "9999px" ? "rounded-full" : null);
    }
    case "fontSize": {
      const fontMap: Record<number, string> = {
        12: "text-xs", 14: "text-sm", 16: "text-base", 18: "text-lg",
        20: "text-xl", 24: "text-2xl", 30: "text-3xl", 36: "text-4xl",
        48: "text-5xl", 60: "text-6xl", 72: "text-7xl", 96: "text-8xl", 128: "text-9xl",
      };
      return fontMap[num] || null;
    }
    case "fontWeight": {
      const weightMap: Record<string, string> = {
        "100": "font-thin", "200": "font-extralight", "300": "font-light",
        "400": "font-normal", "500": "font-medium", "600": "font-semibold",
        "700": "font-bold", "800": "font-extrabold", "900": "font-black",
      };
      return weightMap[value] || null;
    }
    default:
      return null;
  }
}

function truncate(str: string, len: number): string {
  const cleaned = str.replace(/\s+/g, " ").trim();
  return cleaned.length > len ? cleaned.slice(0, len) + "\u2026" : cleaned;
}

function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

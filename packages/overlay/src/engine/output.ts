/**
 * Format element changes as structured markdown for AI agents.
 * Three fidelity levels control how much context is included.
 */

import type { ElementChange } from "../types";

export type Fidelity = "minimal" | "standard" | "full";

export function formatChanges(changes: ElementChange[], fidelity: Fidelity): string {
  if (changes.length === 0) return "No changes recorded.";

  const sections = changes.map((change) => formatSingleChange(change, fidelity));
  const header = `# Visual Changes (${changes.length} element${changes.length > 1 ? "s" : ""})\n`;
  return header + "\n" + sections.join("\n---\n\n");
}

function formatSingleChange(change: ElementChange, fidelity: Fidelity): string {
  const lines: string[] = [];

  // Element identification
  lines.push(`## \`<${change.tagName}>\`${change.textContent ? ` "${truncate(change.textContent, 40)}"` : ""}`);

  if (fidelity !== "minimal") {
    lines.push("");
    if (change.reactComponents.length > 0) {
      lines.push(`**Component:** ${change.reactComponents.join(" > ")}`);
    }
    lines.push(`**Selector:** \`${change.selector}\``);
  }

  if (fidelity === "full" && change.classes.length > 0) {
    lines.push(`**Classes:** \`${change.classes.join(" ")}\``);
  }

  // Changes
  lines.push("");
  lines.push("**Changes:**");
  lines.push("");
  for (const prop of change.changes) {
    const kebab = camelToKebab(prop.property);
    lines.push(`- \`${kebab}\`: \`${prop.from}\` → \`${prop.to}\``);
  }

  lines.push("");
  return lines.join("\n");
}

function truncate(str: string, len: number): string {
  const cleaned = str.replace(/\s+/g, " ").trim();
  return cleaned.length > len ? cleaned.slice(0, len) + "…" : cleaned;
}

function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

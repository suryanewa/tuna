/**
 * Shared utility functions for the overlay UI.
 */

import type { InspectedElement } from "../types";
import { getSelector, getReactComponentHierarchy, getReactProps, getReactSource } from "../selector/identifier";
import { getRelevantStyles, detectLayoutMode } from "../inspector/styles";
import { detectStylingApproach } from "../inspector/tokens";

/** Inspect a DOM element and return all relevant metadata */
export function inspectElement(element: Element): InspectedElement {
  return {
    element,
    selector: getSelector(element),
    tagName: element.tagName,
    textContent: element.textContent?.trim().slice(0, 100) || null,
    classes: element.className && typeof element.className === "string"
      ? element.className.trim().split(/\s+/)
      : [],
    rect: element.getBoundingClientRect(),
    computedStyles: getRelevantStyles(element),
    layoutMode: detectLayoutMode(element),
    reactComponents: getReactComponentHierarchy(element),
    reactProps: getReactProps(element),
    sourceFile: getReactSource(element),
    stylingApproach: detectStylingApproach(element),
    inlineStyles: (element as HTMLElement).style?.cssText || null,
  };
}

/** Check if a keyboard event matches a hotkey string like "alt+d" */
export function matchesHotkey(e: KeyboardEvent, hotkey: string): boolean {
  const parts = hotkey.toLowerCase().split("+");
  const key = parts.pop()!;
  const needsAlt = parts.includes("alt");
  const needsCtrl = parts.includes("ctrl");
  const needsMeta = parts.includes("meta") || parts.includes("cmd");
  const needsShift = parts.includes("shift");
  return (
    e.key.toLowerCase() === key &&
    e.altKey === needsAlt &&
    e.ctrlKey === needsCtrl &&
    e.metaKey === needsMeta &&
    e.shiftKey === needsShift
  );
}

/** Truncate a string, collapsing whitespace */
export function truncate(str: string, len: number): string {
  const cleaned = str.replace(/\s+/g, " ").trim();
  return cleaned.length > len ? cleaned.slice(0, len) + "\u2026" : cleaned;
}

/** Convert rgb()/rgba() to hex */
export function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return rgb.startsWith("#") ? rgb : "#000000";
  const r = parseInt(match[1]).toString(16).padStart(2, "0");
  const g = parseInt(match[2]).toString(16).padStart(2, "0");
  const b = parseInt(match[3]).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

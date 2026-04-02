/**
 * Shared utility functions for the overlay UI.
 */

import type { InspectedElement } from "../types";
import { getSelector, getReactComponentHierarchy, getDirectReactProps, getDirectReactState, getReactSource, getDirectReactComponent } from "../selector/identifier";
import { getRelevantStyles, detectLayoutMode } from "../inspector/styles";
import { detectStylingApproach } from "../inspector/tokens";

/** Inspect a DOM element and return all relevant metadata */
export function inspectElement(element: Element): InspectedElement {
  const rect = element.getBoundingClientRect();
  return {
    element,
    selector: getSelector(element),
    tagName: element.tagName,
    textContent: getDirectTextContent(element),
    classes: element.className && typeof element.className === "string"
      ? element.className.trim().split(/\s+/)
      : [],
    rect,
    computedStyles: getRelevantStyles(element),
    layoutMode: detectLayoutMode(element),
    reactComponents: getReactComponentHierarchy(element),
    reactProps: getDirectReactProps(element),
    reactState: getDirectReactState(element),
    sourceFile: getReactSource(element),
    stylingApproach: detectStylingApproach(element),
    inlineStyles: (element as HTMLElement).style?.cssText || null,
    elementId: element.id || null,
    accessibleName: getAccessibleName(element),
    parentContext: getParentContext(element),
    childSummary: getChildSummary(element),
    domPath: getDomPath(element),
    nearbySiblings: getNearbySiblings(element),
    position: {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
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
  // On macOS, Alt/Option transforms e.key (e.g. Option+D → "∂").
  // Fall back to e.code (physical key) when Alt is held.
  const pressedKey = e.key.toLowerCase();
  const codeKey = e.code?.replace(/^(Key|Digit)/i, "").toLowerCase() || "";
  const keyMatch = pressedKey === key || (needsAlt && codeKey === key);
  return (
    keyMatch &&
    e.altKey === needsAlt &&
    e.ctrlKey === needsCtrl &&
    e.metaKey === needsMeta &&
    e.shiftKey === needsShift
  );
}

/** Get only the element's own direct text, not children's text */
function getDirectTextContent(element: Element): string | null {
  const parts: string[] = [];
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) parts.push(text);
    }
  }
  const result = parts.join(" ").trim();
  return result ? result.slice(0, 100) : null;
}

/** Get accessible name from aria-label, alt, title, or role */
function getAccessibleName(element: Element): string | null {
  const label = element.getAttribute("aria-label")
    || element.getAttribute("alt")
    || element.getAttribute("title")
    || element.getAttribute("placeholder")
    || element.getAttribute("name");
  return label || null;
}

/** Get parent element context for disambiguation */
function getParentContext(element: Element): string | null {
  const parent = element.parentElement;
  if (!parent || parent === document.body) return null;
  const tag = parent.tagName.toLowerCase();
  const id = parent.id ? `#${parent.id}` : "";
  const cls = parent.className && typeof parent.className === "string"
    ? parent.className.trim().split(/\s+/).slice(0, 3).join(".")
    : "";
  const clsStr = cls ? `.${cls}` : "";
  // Also get React component name from parent if available
  return `${tag}${id}${clsStr}`;
}

/** Get a summary of the element's children */
function getChildSummary(element: Element): string | null {
  const children = element.children;
  if (children.length === 0) return null;
  const tags = Array.from(children)
    .slice(0, 6)
    .map(c => c.tagName.toLowerCase());
  const suffix = children.length > 6 ? `, +${children.length - 6} more` : "";
  return `${children.length} children: ${tags.join(", ")}${suffix}`;
}

/** Build a full DOM path like "body > main.content > section > div" */
function getDomPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.documentElement) {
    let part = current.tagName.toLowerCase();
    if (current.id) {
      part += `#${current.id}`;
    } else if (current.className && typeof current.className === "string") {
      const cls = current.className.trim().split(/\s+/).slice(0, 2).join(".");
      if (cls) part += `.${cls}`;
    }
    parts.unshift(part);
    current = current.parentElement;
  }
  return parts.join(" > ");
}

/** Get nearby sibling element tags for context */
function getNearbySiblings(element: Element): string | null {
  const parent = element.parentElement;
  if (!parent) return null;
  const siblings = Array.from(parent.children);
  const index = siblings.indexOf(element);
  const nearby: string[] = [];
  for (let i = Math.max(0, index - 2); i < Math.min(siblings.length, index + 3); i++) {
    const sib = siblings[i];
    const tag = sib.tagName.toLowerCase();
    const label = i === index ? `**${tag}**` : tag;
    nearby.push(label);
  }
  return nearby.join(", ");
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

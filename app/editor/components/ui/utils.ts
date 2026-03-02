"use client";

/**
 * Shared utilities for editor UI components
 */

/**
 * Extract numeric value from a Tailwind class string
 * e.g., "gap-4" -> "4", "p-2.5" -> "2.5", "mt-auto" -> "auto"
 */
export function extractTailwindValue(twClass: string | undefined): string {
  if (!twClass) return "";

  // Handle special values
  if (twClass.includes("auto")) return "auto";
  if (twClass.includes("full")) return "full";
  if (twClass.includes("screen")) return "screen";

  // Extract numeric value (including fractions and decimals)
  const match = twClass.match(/[-]?[\d./]+$/);
  return match ? match[0] : "";
}

/**
 * Extract the display label from a Tailwind class
 * e.g., "gap-4" -> "4", "justify-center" -> "center"
 */
export function extractDisplayLabel(twClass: string | undefined): string {
  if (!twClass) return "-";

  // Common patterns: gap-4, p-2, justify-center, items-start
  const parts = twClass.split("-");
  if (parts.length >= 2) {
    return parts.slice(1).join("-");
  }
  return twClass;
}

/**
 * Build a Tailwind class from a prefix and value
 * e.g., ("gap", "4") -> "gap-4"
 */
export function buildTailwindClass(prefix: string, value: string): string {
  if (!value || value === "-") return "";
  return `${prefix}-${value}`;
}

/**
 * Parse a color value for display
 * Returns a simplified representation for Tailwind color classes
 */
export function parseColorForDisplay(value: string | undefined): string {
  if (!value) return "FFFFFF";

  // Handle hex colors directly
  if (value.startsWith("#")) {
    return value.replace("#", "").toUpperCase();
  }

  // Handle Tailwind color classes
  const colorMatch = value.match(/-([\w]+)-(\d+)$/);
  if (colorMatch) {
    return `${colorMatch[1]}-${colorMatch[2]}`;
  }

  // Strip prefix and return
  return value.replace(/^(bg-|text-|border-)/, "");
}

/**
 * Clamp a numeric value between min and max
 */
export function clampValue(value: number, min?: number, max?: number): number {
  let result = value;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

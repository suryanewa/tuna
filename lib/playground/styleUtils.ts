// Playground Style Utilities

import type { PageStyles } from "./store";
import type { CSSProperties } from "react";

/**
 * Build a CSS style object from page styles.
 * Null values are omitted, meaning browser defaults apply.
 */
export function buildStyleObject(styles: PageStyles | null): CSSProperties {
  if (!styles) return {};

  const css: CSSProperties = {};

  // Colors
  if (styles.backgroundColor) {
    css.backgroundColor = styles.backgroundColor;
  }
  if (styles.textColor) {
    css.color = styles.textColor;
  }

  // Typography
  if (styles.fontFamily) {
    css.fontFamily = styles.fontFamily;
  }
  if (styles.lineHeight) {
    css.lineHeight = styles.lineHeight;
  }

  // Spacing
  if (styles.contentPadding) {
    css.padding = `${styles.contentPadding}px`;
  }

  // Borders
  if (styles.borderWidth && styles.borderWidth > 0) {
    css.borderWidth = `${styles.borderWidth}px`;
    css.borderStyle = styles.borderStyle || "solid";
    css.borderColor = styles.borderColor || "#000";
  }
  if (styles.borderRadius) {
    css.borderRadius = `${styles.borderRadius}px`;
  }

  // Effects
  if (styles.shadowIntensity && styles.shadowIntensity > 0) {
    const intensity = styles.shadowIntensity;
    const color = styles.shadowColor || "rgba(0,0,0,0.2)";
    css.boxShadow = `0 ${intensity / 10}px ${intensity / 5}px ${color}`;
  }

  // Layout
  if (styles.maxWidth) {
    css.maxWidth = `${styles.maxWidth}px`;
    css.marginLeft = "auto";
    css.marginRight = "auto";
  }
  if (styles.textAlign) {
    css.textAlign = styles.textAlign as CSSProperties["textAlign"];
  }

  return css;
}

/**
 * Build CSS for link elements
 */
export function buildLinkStyles(styles: PageStyles | null): CSSProperties {
  if (!styles) return {};

  const css: CSSProperties = {};

  if (styles.fontFamily) {
    css.fontFamily = styles.fontFamily;
  }

  return css;
}

/**
 * Build CSS for heading elements
 */
export function buildHeadingStyles(styles: PageStyles | null): CSSProperties {
  if (!styles) return {};

  const css: CSSProperties = {};

  if (styles.fontFamily) {
    css.fontFamily = styles.fontFamily;
  }

  if (styles.textColor) {
    css.color = styles.textColor;
  }

  return css;
}

/**
 * Build CSS for the container based on layout mode
 */
export function buildLayoutStyles(styles: PageStyles | null): CSSProperties {
  if (!styles) return {};

  const css: CSSProperties = {};

  switch (styles.layoutMode) {
    case "centered":
      css.display = "flex";
      css.flexDirection = "column";
      css.alignItems = "center";
      css.textAlign = "center";
      break;
    case "grid":
      css.display = "grid";
      css.gridTemplateColumns = "repeat(auto-fit, minmax(300px, 1fr))";
      css.gap = styles.elementGap ? `${styles.elementGap}px` : "16px";
      break;
    case "stack":
    default:
      css.display = "block";
      break;
  }

  if (styles.elementGap && styles.layoutMode !== "grid") {
    css.display = "flex";
    css.flexDirection = "column";
    css.gap = `${styles.elementGap}px`;
  }

  return css;
}

/**
 * Build gradient CSS if enabled
 */
export function buildGradientStyles(styles: PageStyles | null): CSSProperties {
  if (!styles || !styles.gradientEnabled) return {};

  const start = styles.gradientStart || "#ffffff";
  const end = styles.gradientEnd || "#000000";
  const angle = styles.gradientAngle || 180;

  return {
    backgroundImage: `linear-gradient(${angle}deg, ${start}, ${end})`,
  };
}

/**
 * Check if a color string is valid hex
 */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(color);
}

/**
 * Ensure color has # prefix
 */
export function normalizeColor(color: string): string {
  if (!color) return color;
  if (color.startsWith("#")) return color;
  return `#${color}`;
}

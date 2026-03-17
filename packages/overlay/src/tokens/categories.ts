import type { VariableCategory } from "./types";

/** Map CSS properties to token categories */
const PROPERTY_CATEGORY: Record<string, VariableCategory> = {
  // Spacing
  "padding": "spacing", "padding-top": "spacing", "padding-right": "spacing",
  "padding-bottom": "spacing", "padding-left": "spacing",
  "margin": "spacing", "margin-top": "spacing", "margin-right": "spacing",
  "margin-bottom": "spacing", "margin-left": "spacing",
  "gap": "spacing", "row-gap": "spacing", "column-gap": "spacing",

  // Sizing
  "width": "sizing", "height": "sizing",
  "min-width": "sizing", "max-width": "sizing",
  "min-height": "sizing", "max-height": "sizing",

  // Colors
  "color": "colors", "background-color": "colors",
  "border-color": "colors",
  "border-top-color": "colors", "border-right-color": "colors",
  "border-bottom-color": "colors", "border-left-color": "colors",
  "outline-color": "colors",

  // Typography (per-property categories)
  "font-size": "font-size",
  "font-weight": "font-weight",
  "line-height": "line-height",
  "letter-spacing": "letter-spacing",
  "font-family": "font-family",

  // Borders
  "border-radius": "borders",
  "border-top-left-radius": "borders", "border-top-right-radius": "borders",
  "border-bottom-left-radius": "borders", "border-bottom-right-radius": "borders",
  "border-width": "borders",
  "border-top-width": "borders", "border-right-width": "borders",
  "border-bottom-width": "borders", "border-left-width": "borders",

  // Shorthands (for usage-map categorization of var() references)
  "background": "colors",
  "border": "borders",

  // Effects
  "box-shadow": "effects", "opacity": "effects",

  // Layout
  "display": "layout", "flex-direction": "layout",
  "align-items": "layout", "justify-content": "layout",
  "flex-wrap": "layout", "position": "layout",
};

/** Get the token category for a CSS property, or null if not categorized */
export function getCategoryForProperty(prop: string): VariableCategory | null {
  return PROPERTY_CATEGORY[prop] ?? null;
}

/** Get all CSS properties that belong to a category */
export function getPropertiesForCategory(category: VariableCategory): string[] {
  return Object.entries(PROPERTY_CATEGORY)
    .filter(([, cat]) => cat === category)
    .map(([prop]) => prop);
}

/** Get the category for a camelCase property name (converts to kebab-case first) */
export function getCategoryForCamelProp(prop: string): VariableCategory | null {
  const kebab = prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  return getCategoryForProperty(kebab);
}

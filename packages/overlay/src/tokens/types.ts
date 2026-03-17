/** A utility class token that maps to CSS properties */
export interface DesignVariable {
  /** The class name (e.g., "py-4", "text-lg", "bg-red-500") */
  className: string;
  /** CSS properties and their resolved computed values */
  values: Record<string, string>;
  /** The @layer this token was found in (e.g., "utilities", "components", "base") */
  layerName?: string;
}

/** Token categories grouped by property type */
export type VariableCategory =
  | "spacing"
  | "sizing"
  | "colors"
  | "font-size"
  | "font-weight"
  | "line-height"
  | "letter-spacing"
  | "font-family"
  | "borders"
  | "effects"
  | "layout";

/** Detected CSS framework */
export type CssFramework = "tailwind" | "custom" | "unknown";

/** The full registry of discovered tokens */
export interface VariableRegistry {
  /** Tokens grouped by category */
  groups: Map<VariableCategory, DesignVariable[]>;
  /** Reverse lookup: "property:value" → matching tokens */
  valueLookup: Map<string, DesignVariable[]>;
  /** Forward lookup: className → token */
  classLookup: Map<string, DesignVariable>;
  /** Detected CSS framework (tailwind, custom, unknown) */
  framework: CssFramework;
}

/** Which token currently provides a property's value on the selected element */
export interface VariableMatch {
  variable: DesignVariable;
  property: string;
}

/** A utility class token that maps to CSS properties */
export interface UtilityToken {
  /** The class name (e.g., "py-4", "text-lg", "bg-red-500") */
  className: string;
  /** CSS properties and their resolved computed values */
  values: Record<string, string>;
}

/** Token categories grouped by property type */
export type TokenCategory =
  | "spacing"
  | "sizing"
  | "colors"
  | "typography"
  | "borders"
  | "effects"
  | "layout";

/** The full registry of discovered tokens */
export interface TokenRegistry {
  /** Tokens grouped by category */
  groups: Map<TokenCategory, UtilityToken[]>;
  /** Reverse lookup: "property:value" → matching tokens */
  valueLookup: Map<string, UtilityToken[]>;
  /** Forward lookup: className → token */
  classLookup: Map<string, UtilityToken>;
}

/** Which token currently provides a property's value on the selected element */
export interface TokenMatch {
  token: UtilityToken;
  property: string;
}

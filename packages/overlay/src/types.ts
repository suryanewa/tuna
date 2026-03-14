export interface RetuneConfig {
  /** WebSocket port for MCP server bridge (default: 9223) */
  port?: number;
  /** Hotkey to toggle edit mode (default: "alt+d") */
  hotkey?: string;
  /** Output fidelity level (default: "standard") */
  fidelity?: "minimal" | "standard" | "full";
  /** Position of the floating toolbar */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Show overlay even in production (default: false) */
  force?: boolean;
}

export interface InspectedElement {
  /** The DOM element */
  element: Element;
  /** Unique CSS selector */
  selector: string;
  /** Element tag name */
  tagName: string;
  /** Text content (truncated) */
  textContent: string | null;
  /** Applied CSS classes */
  classes: string[];
  /** Bounding box */
  rect: DOMRect;
  /** Computed styles (subset relevant to the element type) */
  computedStyles: Record<string, string>;
  /** Detected layout mode */
  layoutMode: "block" | "flex" | "grid" | "inline" | "absolute" | "fixed" | "relative" | "sticky";
  /** React component hierarchy (if React app) */
  reactComponents: string[];
  /** React component props (from nearest component) */
  reactProps: Record<string, unknown> | null;
  /** Source file location from React fiber */
  sourceFile: { fileName: string; lineNumber: number; columnNumber?: number } | null;
  /** Detected styling approach */
  stylingApproach: string;
  /** Inline style attribute (authored, not computed) */
  inlineStyles: string | null;
  /** Element's id attribute */
  elementId: string | null;
  /** Accessible name (aria-label, alt, title, etc.) */
  accessibleName: string | null;
  /** Parent element context for disambiguation */
  parentContext: string | null;
  /** Child summary (e.g. "3 children: h2, p, button") */
  childSummary: string | null;
  /** Full DOM path (e.g. "body > main > section > div") */
  domPath: string;
  /** Nearby sibling elements */
  nearbySiblings: string | null;
  /** Element position and dimensions */
  position: { x: number; y: number; width: number; height: number };
}

export interface PropertyChange {
  property: string;
  from: string;
  to: string;
}

/** A candidate token/class/variable for a changed property's value */
export interface PropertyCandidate {
  type: "semantic-token" | "utility-class" | "css-variable";
  /** Class name or var(--name) */
  name: string;
  /** Resolved CSS value */
  value: string;
  /** Whether this exactly matches the user's new value */
  exact: boolean;
  /** For fuzzy matches: e.g. "nearest: 1rem vs 1.1rem" */
  distance?: string;
}

/** Enriched property change with resolution context */
export interface EnrichedPropertyChange extends PropertyChange {
  /** Best matching candidate (exact match preferred) */
  recommended?: PropertyCandidate;
  /** Alternative candidates in the same category (max 3) */
  alternatives: PropertyCandidate[];
  /** CSS custom property names matching this value */
  cssVariables: string[];
  /** Where the original value comes from in the cascade */
  source?: {
    selector: string;
    origin: "inline" | "stylesheet" | "user-agent";
    stylesheet?: string;
    important: boolean;
    mediaQuery?: string;
  };
  /** Competing rules that could cause specificity conflicts */
  conflicts?: Array<{
    selector: string;
    value: string;
    important: boolean;
  }>;
}

export interface ElementChange {
  /** Element identification */
  selector: string;
  tagName: string;
  textContent: string | null;
  classes: string[];
  reactComponents: string[];
  /** What changed */
  changes: PropertyChange[];
  /** Timestamp */
  timestamp: number;
  /** Source file location */
  sourceFile?: { fileName: string; lineNumber: number; columnNumber?: number } | null;
  /** Detected styling approach */
  stylingApproach?: string;
  /** Inline style attribute */
  inlineStyles?: string | null;
  /** Element's id attribute */
  elementId?: string | null;
  /** Accessible name */
  accessibleName?: string | null;
  /** Parent element context */
  parentContext?: string | null;
  /** Child summary */
  childSummary?: string | null;
  /** Full DOM path */
  domPath?: string;
  /** Nearby sibling elements */
  nearbySiblings?: string | null;
  /** Element position and dimensions */
  position?: { x: number; y: number; width: number; height: number };
  /** Token associations from the UI (user-applied tokens) */
  tokenAssociations?: Record<string, { className: string; values: Record<string, string> }>;
}

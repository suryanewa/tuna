export interface ComposerConfig {
  /** WebSocket port for MCP server bridge (default: 9223) */
  port?: number;
  /** Hotkey to toggle edit mode (default: "alt+d") */
  hotkey?: string;
  /** Output fidelity level (default: "standard") */
  fidelity?: "minimal" | "standard" | "full";
  /** Position of the floating toolbar */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
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
}

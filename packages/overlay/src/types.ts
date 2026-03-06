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
  layoutMode: "block" | "flex" | "grid" | "inline" | "absolute" | "fixed";
  /** React component hierarchy (if React app) */
  reactComponents: string[];
  /** React component props (from nearest component) */
  reactProps: Record<string, unknown> | null;
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
}

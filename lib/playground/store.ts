type JsonObject = Record<string, unknown>;

import type { TailwindStyles, ResponsiveStyles } from "./editor-types";

// Page type for multi-page support
export type Page = {
  id: string;
  name: string;
  slug?: string;
  isHomepage?: boolean;  // true = renders at /playground without slug
  order: number;
  createdBy: string;
  createdAt: number;
  component?: string; // If set, renders a React component instead of editor elements
  provider?: string; // If set, wraps elements in a context provider (e.g. "podcast")
  artboardName?: string; // Display name for the artboard layer (default: "Desktop")
};

// Element type enum for type-safe element handling (legacy + new types)
export type ElementType =
  | "text"
  | "image"
  | "shape"
  | "sticker"
  | "divider"
  // V0 editor types
  | "heading"
  | "button"
  | "link"
  | "container"
  | "badge"
  // Shape elements (Phase B)
  | "rectangle"
  | "circle"
  | "star"
  // Media
  | "video"
  // Component elements (renders React components inside editor wrappers)
  | "component";

// Element types for the design canvas
export type CanvasElement = {
  id: string;
  type: ElementType;
  name?: string; // Optional custom name for layer panel
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation: number;
  scale: number;
  zIndex: number;
  content: string;
  createdBy: string;
  createdAt: number;

  // Legacy CSS property-based styles
  styles: ElementStyles;

  // NEW: V0 Tailwind-based styles (preferred for new elements)
  tailwindStyles?: TailwindStyles;
  responsiveStyles?: ResponsiveStyles;

  // Multi-page support
  pageId: string; // which page this element belongs to

  // NEW: Hierarchy support
  parentId?: string | null;
  children?: string[];

  // Rich text content (Tiptap JSON document)
  richContent?: JsonObject | null;

  // For text elements
  isEditing?: boolean;

  // Image alt text for accessibility
  alt?: string;

  // Element-level link wrapping
  link?: { url: string; target: "_self" | "_blank" } | null;

  // Layer panel controls
  hidden?: boolean;  // true = not visible on canvas
  locked?: boolean;  // true = cannot be moved/resized/edited on canvas

  // Video settings
  videoAutoplay?: boolean;
  videoLoop?: boolean;
  videoControls?: boolean;
  videoMuted?: boolean;

  // Component element discriminator
  componentName?: string; // Maps to a React component (e.g. "podcast-player")

  // UDS design system component
  mcpComponentId?: string; // UDS component name (e.g. "Button", "Avatar")
  mcpProps?: Record<string, unknown>; // User-set prop values for the UDS component

  // Infinite canvas placement
  placement?: "artboard" | "canvas"; // default: "artboard"

};

export type ElementStyles = {
  backgroundColor?: string;
  color?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  lineHeight?: number;
  letterSpacing?: number;
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  borderStyle?: string;
  opacity?: number;
  shadow?: string;
  blur?: number;
  padding?: number;
  margin?: number;
  // Preset tracking
  presetId?: string | null;
  presetOverrides?: Record<string, string | number | boolean | null>;
};

// Style preset for reusable styles
export type StylePreset = {
  id: string;
  name: string;
  applicableTo: ElementType[];
  styles: Partial<ElementStyles>;
  isBuiltIn: boolean;
  createdBy: string;
  createdAt: number;
};

// Global page styles (the "unstyled to styled" concept)
export type PageStyles = {
  name: string;
  backgroundColor: string | null;
  backgroundOpacity: number | null;
  textColor: string | null;
  fontFamily: string | null;
  lineHeight: number | null;
  contentPadding: number | null;
  contentPaddingX: number | null;
  contentPaddingY: number | null;
  contentPaddingTop: number | null;
  contentPaddingRight: number | null;
  contentPaddingBottom: number | null;
  contentPaddingLeft: number | null;
  elementGap: number | null;
  borderWidth: number | null;
  borderColor: string | null;
  borderOpacity: number | null;
  borderRadius: number | null;
  borderStyle: string | null;
  shadowIntensity: number | null;
  shadowColor: string | null;
  shadowData: string | null;
  layoutMode: "stack" | "centered" | "end" | "grid" | "horizontal";
  justifyContent: string | null;
  alignItems: string | null;
  maxWidth: number | null;
  textAlign: string | null;
  gradientEnabled: boolean;
  gradientStart: string | null;
  gradientEnd: string | null;
  gradientAngle: number;
  gradientType: "linear" | "radial" | "conic" | null;
  gradientStops: string | null;  // JSON-encoded GradientStop[] for full fidelity
  backgroundFills: string | null;  // JSON-encoded fill items for multi-fill support
  artboardX: number;  // World X position of the artboard
  artboardY: number;  // World Y position of the artboard
};

// Virtual ID for the artboard (page frame) in the selection system.
// The artboard is not a real element in the store — it's a layout wrapper.
export const ARTBOARD_LAYER_ID = "__artboard__";

// Default page styles (all null = browser defaults)
export const defaultPageStyles: PageStyles = {
  name: "Page",
  backgroundColor: null,
  backgroundOpacity: null,
  textColor: null,
  fontFamily: null,
  lineHeight: null,
  contentPadding: null,
  contentPaddingX: null,
  contentPaddingY: null,
  contentPaddingTop: null,
  contentPaddingRight: null,
  contentPaddingBottom: null,
  contentPaddingLeft: null,
  elementGap: null,
  borderWidth: null,
  borderColor: null,
  borderOpacity: null,
  borderRadius: null,
  borderStyle: null,
  shadowIntensity: null,
  shadowColor: null,
  shadowData: null,
  layoutMode: "stack",
  justifyContent: null,
  alignItems: null,
  maxWidth: null,
  textAlign: null,
  gradientEnabled: false,
  gradientStart: null,
  gradientEnd: null,
  gradientAngle: 180,
  gradientType: null,
  gradientStops: null,
  backgroundFills: null,
  artboardX: 0,
  artboardY: 0,
};

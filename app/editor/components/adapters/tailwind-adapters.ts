/**
 * Pure adapter functions converting TailwindStyles ↔ sections-v2 prop shapes.
 * Each read/write pair documents which TailwindStyles fields it touches.
 */

import type { TailwindStyles } from "@/lib/playground/editor-types";
import type {
  FlowDirection,
  AlignmentPosition,
  SpacingMode,
  SpacingSide,
  BlendMode,
  OverflowValue,
  PositionType,
  PinState,
  StickyEdge,
  TextAlignment,
  VerticalAlignment,
  FontWeightOption,
  BorderValue,
  BorderStyle,
  BorderSide,
  ShadowValue,
  FillItem,
  GradientFill,
  GradientStop,
  FilterItem,
  FilterType,
  FilterTarget,
} from "../sections-v2";

// ============================================================================
// Lookup Tables
// ============================================================================

/** Tailwind spacing unit → pixel value */
const SPACING_TO_PX: Record<string, number> = {
  "0": 0, "0.5": 2, "1": 4, "1.5": 6, "2": 8, "2.5": 10,
  "3": 12, "3.5": 14, "4": 16, "5": 20, "6": 24, "7": 28,
  "8": 32, "9": 36, "10": 40, "11": 44, "12": 48, "14": 56,
  "16": 64, "20": 80, "24": 96,
};

/** Pixel value → Tailwind spacing unit */
const PX_TO_SPACING: Record<number, string> = {};
for (const [k, v] of Object.entries(SPACING_TO_PX)) {
  PX_TO_SPACING[v] = k;
}

/** Tailwind font size class → pixel value */
const FONT_SIZE_TO_PX: Record<string, number> = {
  "text-xs": 12, "text-sm": 14, "text-base": 16, "text-lg": 18,
  "text-xl": 20, "text-2xl": 24, "text-3xl": 30, "text-4xl": 36,
  "text-5xl": 48, "text-6xl": 60, "text-7xl": 72, "text-8xl": 96,
  "text-9xl": 128,
};

/** Pixel value → Tailwind font size class */
const PX_TO_FONT_SIZE: Record<number, string> = {};
for (const [k, v] of Object.entries(FONT_SIZE_TO_PX)) {
  PX_TO_FONT_SIZE[v] = k;
}

/** Tailwind font weight class → numeric weight */
const FONT_WEIGHT_TO_NUM: Record<string, number> = {
  "font-thin": 100, "font-extralight": 200, "font-light": 300,
  "font-normal": 400, "font-medium": 500, "font-semibold": 600,
  "font-bold": 700, "font-extrabold": 800, "font-black": 900,
};

/** Numeric weight → Tailwind font weight class */
const NUM_TO_FONT_WEIGHT: Record<number, string> = {};
for (const [k, v] of Object.entries(FONT_WEIGHT_TO_NUM)) {
  NUM_TO_FONT_WEIGHT[v] = k;
}

/** Font weight display labels */
const FONT_WEIGHT_LABELS: Record<string, string> = {
  "font-thin": "Thin", "font-extralight": "Extra Light", "font-light": "Light",
  "font-normal": "Regular", "font-medium": "Medium", "font-semibold": "Semi Bold",
  "font-bold": "Bold", "font-extrabold": "Extra Bold", "font-black": "Black",
};

/** Tailwind border radius class → pixel value */
const BORDER_RADIUS_TO_PX: Record<string, number> = {
  "rounded-none": 0, "rounded-sm": 2, "rounded": 4, "rounded-md": 6,
  "rounded-lg": 8, "rounded-xl": 12, "rounded-2xl": 16, "rounded-3xl": 24,
  "rounded-full": 9999,
};

/** Pixel value → Tailwind border radius class */
const PX_TO_BORDER_RADIUS: Record<number, string> = {};
for (const [k, v] of Object.entries(BORDER_RADIUS_TO_PX)) {
  PX_TO_BORDER_RADIUS[v] = k;
}

/** Tailwind line height class → display value for sections-v2 */
const LINE_HEIGHT_TO_VALUE: Record<string, string> = {
  "leading-none": "1",
  "leading-tight": "1.25",
  "leading-snug": "1.375",
  "leading-normal": "auto",
  "leading-relaxed": "1.625",
  "leading-loose": "2",
};

/** Tailwind letter spacing class → percentage display */
const LETTER_SPACING_TO_PERCENT: Record<string, string> = {
  "tracking-tighter": "-5%",
  "tracking-tight": "-2.5%",
  "tracking-normal": "0%",
  "tracking-wide": "2.5%",
  "tracking-wider": "5%",
  "tracking-widest": "10%",
};

/** Percentage → Tailwind letter spacing class */
const PERCENT_TO_LETTER_SPACING: Record<string, string> = {};
for (const [k, v] of Object.entries(LETTER_SPACING_TO_PERCENT)) {
  PERCENT_TO_LETTER_SPACING[v] = k;
}

/** Tailwind shadow preset → ShadowValue approximation */
export const SHADOW_PRESETS: Record<string, ShadowValue> = {
  "shadow-none": { type: "outside", angle: 90, distance: 0, brightness: 0, elevation: 0, color: "#000000", opacity: 0 },
  "shadow-xs": { type: "outside", angle: 90, distance: 4, brightness: 5, elevation: 20, color: "#000000", opacity: 5 },
  "shadow-sm": { type: "outside", angle: 90, distance: 8, brightness: 5, elevation: 30, color: "#000000", opacity: 8 },
  "shadow": { type: "outside", angle: 90, distance: 12, brightness: 8, elevation: 50, color: "#000000", opacity: 10 },
  "shadow-md": { type: "outside", angle: 90, distance: 20, brightness: 8, elevation: 60, color: "#000000", opacity: 10 },
  "shadow-lg": { type: "outside", angle: 90, distance: 30, brightness: 10, elevation: 80, color: "#000000", opacity: 12 },
  "shadow-xl": { type: "outside", angle: 90, distance: 36, brightness: 10, elevation: 100, color: "#000000", opacity: 15 },
  "shadow-2xl": { type: "outside", angle: 90, distance: 50, brightness: 15, elevation: 100, color: "#000000", opacity: 25 },
};

export const INSET_SHADOW_PRESETS: Record<string, ShadowValue> = {
  "inset-shadow-none": { type: "inside", angle: 90, distance: 0, brightness: 0, elevation: 0, color: "#000000", opacity: 0 },
  "inset-shadow-xs": { type: "inside", angle: 90, distance: 4, brightness: 5, elevation: 20, color: "#000000", opacity: 5 },
  "inset-shadow-sm": { type: "inside", angle: 90, distance: 8, brightness: 5, elevation: 30, color: "#000000", opacity: 8 },
  "inset-shadow": { type: "inside", angle: 90, distance: 12, brightness: 8, elevation: 50, color: "#000000", opacity: 10 },
  "inset-shadow-md": { type: "inside", angle: 90, distance: 20, brightness: 8, elevation: 60, color: "#000000", opacity: 10 },
  "inset-shadow-lg": { type: "inside", angle: 90, distance: 30, brightness: 10, elevation: 80, color: "#000000", opacity: 12 },
};

/** Tailwind blur class → pixel value */
const BLUR_TO_PX: Record<string, number> = {
  "blur-none": 0, "blur-sm": 4, "blur": 8, "blur-md": 12,
  "blur-lg": 16, "blur-xl": 24, "blur-2xl": 40, "blur-3xl": 64,
};

const BACKDROP_BLUR_TO_PX: Record<string, number> = {
  "backdrop-blur-none": 0, "backdrop-blur-sm": 4, "backdrop-blur": 8,
  "backdrop-blur-md": 12, "backdrop-blur-lg": 16, "backdrop-blur-xl": 24,
  "backdrop-blur-2xl": 40, "backdrop-blur-3xl": 64,
};

/** Border width class → pixel value */
const BORDER_WIDTH_TO_PX: Record<string, number> = {
  "border-0": 0, "border": 1, "border-2": 2, "border-4": 4, "border-8": 8,
};

// ============================================================================
// Generic Helpers
// ============================================================================

/** Parse an arbitrary bracket pixel value: "[15px]" → 15, "[12.5px]" → 12.5 */
function parseArbitraryPx(unit: string): number | undefined {
  const arbMatch = unit.match(/^\[(-?[\d.]+)px\]$/);
  if (arbMatch) return parseFloat(arbMatch[1]);
  return undefined;
}

/** Parse spacing from a Tailwind spacing class: "p-4" → 16 (px), also handles arbitrary "p-[15px]" */
function parseSpacing(value: string | undefined, prefix: string): number | undefined {
  if (!value) return undefined;
  if (!value.startsWith(prefix)) return undefined;
  const unit = value.slice(prefix.length);
  // Check named lookup first
  const named = SPACING_TO_PX[unit];
  if (named !== undefined) return named;
  // Parse arbitrary bracket value: "[15px]" or "[12.5px]"
  return parseArbitraryPx(unit);
}

/** Write a spacing value: 16 → "p-4" */
function writeSpacing(px: number | undefined, prefix: string): string | undefined {
  if (px === undefined) return undefined;
  const unit = PX_TO_SPACING[px];
  if (unit !== undefined) return `${prefix}${unit}`;
  // Fallback: arbitrary value
  return `${prefix}[${px}px]`;
}

/** Parse a per-corner radius from "rounded-tl-lg" → pixel value */
function parseCornerRadius(value: string | undefined): string | undefined {
  if (!value) return undefined;
  // Parse arbitrary bracket value first: "rounded-tl-[10px]" → "10"
  const arbMatch = value.match(/\[(-?[\d.]+)px\]/);
  if (arbMatch) return arbMatch[1];
  // Try named lookup (e.g., "rounded-tl-none" → strip prefix to get "rounded-none" equivalent)
  for (const [cls, px] of Object.entries(BORDER_RADIUS_TO_PX)) {
    const baseSuffix = cls.replace("rounded", "");
    // Skip empty suffix (from bare "rounded") to avoid false positives via endsWith("")
    if (baseSuffix === "") {
      if (value === cls) return String(px);
      continue;
    }
    if (value.endsWith(baseSuffix) || value === cls) {
      return String(px);
    }
  }
  return undefined;
}

// ============================================================================
// Layout Adapters
// Reads/Writes: flexDirection, justifyContent, alignItems, flexWrap, gap,
//   padding*, margin*, overflow
// ============================================================================

export function readDirection(styles: TailwindStyles): FlowDirection {
  if (styles.flexWrap === "flex-wrap") return "wrap";
  if (styles.flexDirection === "flex-row") return "horizontal";
  return "vertical"; // default
}

export function writeDirection(direction: FlowDirection): Partial<TailwindStyles> {
  switch (direction) {
    case "horizontal":
      return { flexDirection: "flex-row", flexWrap: undefined };
    case "wrap":
      return { flexDirection: "flex-row", flexWrap: "flex-wrap" };
    case "vertical":
    default:
      return { flexDirection: "flex-col", flexWrap: undefined };
  }
}

export function readAlignment(styles: TailwindStyles, flow: FlowDirection = "vertical"): AlignmentPosition {
  const jc = styles.justifyContent || "justify-start";
  const ai = styles.alignItems || "items-stretch";

  const isHorizontal = flow === "horizontal" || flow === "wrap";

  if (isHorizontal) {
    // flex-row: justifyContent = horizontal axis (col), alignItems = vertical axis (row)
    const colMap: Record<string, string> = {
      "justify-start": "left", "justify-center": "center", "justify-end": "right",
    };
    const rowMap: Record<string, string> = {
      "items-start": "top", "items-center": "center", "items-end": "bottom", "items-stretch": "top",
    };

    const row = rowMap[ai] || "top";
    const col = colMap[jc] || "left";

    if (row === "center" && col === "center") return "center-center";
    return `${row}-${col}` as AlignmentPosition;
  }

  // flex-col (vertical): justifyContent = vertical axis (row), alignItems = horizontal axis (col)
  const rowMap: Record<string, string> = {
    "justify-start": "top", "justify-center": "center", "justify-end": "bottom",
  };
  const colMap: Record<string, string> = {
    "items-start": "left", "items-center": "center", "items-end": "right", "items-stretch": "left",
  };

  const row = rowMap[jc] || "top";
  const col = colMap[ai] || "left";

  if (row === "center" && col === "center") return "center-center";
  return `${row}-${col}` as AlignmentPosition;
}

export function writeAlignment(alignment: AlignmentPosition, flow: FlowDirection = "vertical"): Partial<TailwindStyles> {
  const [row, col] = alignment.split("-") as [string, string];

  const isHorizontal = flow === "horizontal" || flow === "wrap";

  if (isHorizontal) {
    // flex-row: col maps to justifyContent (horizontal), row maps to alignItems (vertical)
    const jcMap: Record<string, string> = {
      "left": "justify-start", "center": "justify-center", "right": "justify-end",
    };
    const aiMap: Record<string, string> = {
      "top": "items-start", "center": "items-center", "bottom": "items-end",
    };

    return {
      justifyContent: jcMap[col] || "justify-start",
      alignItems: aiMap[row] || "items-start",
    };
  }

  // flex-col (vertical): row maps to justifyContent, col maps to alignItems
  const jcMap: Record<string, string> = {
    "top": "justify-start", "center": "justify-center", "bottom": "justify-end",
  };
  const aiMap: Record<string, string> = {
    "left": "items-start", "center": "items-center", "right": "items-end",
  };

  return {
    justifyContent: jcMap[row] || "justify-start",
    alignItems: aiMap[col] || "items-start",
  };
}

export function readSpaceBetween(styles: TailwindStyles): boolean {
  return styles.justifyContent === "justify-between";
}

export function writeSpaceBetween(spaceBetween: boolean): Partial<TailwindStyles> {
  return spaceBetween ? { justifyContent: "justify-between" } : { justifyContent: undefined };
}

export function readGap(styles: TailwindStyles): number {
  return parseSpacing(styles.gap, "gap-") ?? 0;
}

export function writeGap(value: number | undefined): Partial<TailwindStyles> {
  return { gap: writeSpacing(value, "gap-") };
}

export function readClipContent(styles: TailwindStyles): boolean {
  return styles.overflow === "overflow-hidden";
}

export function writeClipContent(clip: boolean): Partial<TailwindStyles> {
  return { overflow: clip ? "overflow-hidden" : undefined };
}

// Spacing (padding/margin) helpers

function readSpacingValue(styles: TailwindStyles, field: keyof TailwindStyles): number | undefined {
  const val = styles[field] as string | undefined;
  if (!val) return undefined;
  // Extract prefix and spacing unit
  const match = val.match(/^[a-z]+-(.+)$/);
  if (!match) return undefined;
  const unit = match[1];
  // Check named lookup first
  const named = SPACING_TO_PX[unit];
  if (named !== undefined) return named;
  // Parse arbitrary bracket value: "[15px]" or "[12.5px]"
  return parseArbitraryPx(unit);
}

export function readPaddingMode(styles: TailwindStyles): SpacingMode {
  const hasPerSide = styles.paddingTop || styles.paddingRight || styles.paddingBottom || styles.paddingLeft;
  if (hasPerSide) return "individual";
  return "xy";
}

export function readPaddingValues(styles: TailwindStyles) {
  const px = readSpacingValue(styles, "paddingX") ?? readSpacingValue(styles, "padding") ?? 0;
  const py = readSpacingValue(styles, "paddingY") ?? readSpacingValue(styles, "padding") ?? 0;
  return {
    paddingX: px,
    paddingY: py,
    paddingTop: readSpacingValue(styles, "paddingTop") ?? py,
    paddingRight: readSpacingValue(styles, "paddingRight") ?? px,
    paddingBottom: readSpacingValue(styles, "paddingBottom") ?? py,
    paddingLeft: readSpacingValue(styles, "paddingLeft") ?? px,
  };
}

export function writePadding(
  side: SpacingSide,
  value: number | undefined,
  mode: SpacingMode
): Partial<TailwindStyles> {
  if (mode === "xy") {
    const prefix = side === "x" ? "px-" : "py-";
    const field = side === "x" ? "paddingX" : "paddingY";
    return { [field]: writeSpacing(value, prefix), padding: undefined } as Partial<TailwindStyles>;
  }
  // individual
  const fieldMap: Record<SpacingSide, [keyof TailwindStyles, string]> = {
    x: ["paddingX", "px-"],
    y: ["paddingY", "py-"],
    top: ["paddingTop", "pt-"],
    right: ["paddingRight", "pr-"],
    bottom: ["paddingBottom", "pb-"],
    left: ["paddingLeft", "pl-"],
  };
  const [field, prefix] = fieldMap[side];
  return { [field]: writeSpacing(value, prefix) } as Partial<TailwindStyles>;
}

export function readMarginMode(styles: TailwindStyles): SpacingMode {
  const hasPerSide = styles.marginTop || styles.marginRight || styles.marginBottom || styles.marginLeft;
  if (hasPerSide) return "individual";
  return "xy";
}

export function readMarginValues(styles: TailwindStyles) {
  const mx = readSpacingValue(styles, "marginX") ?? readSpacingValue(styles, "margin") ?? 0;
  const my = readSpacingValue(styles, "marginY") ?? readSpacingValue(styles, "margin") ?? 0;
  return {
    marginX: mx,
    marginY: my,
    marginTop: readSpacingValue(styles, "marginTop") ?? my,
    marginRight: readSpacingValue(styles, "marginRight") ?? mx,
    marginBottom: readSpacingValue(styles, "marginBottom") ?? my,
    marginLeft: readSpacingValue(styles, "marginLeft") ?? mx,
  };
}

export function writeMargin(
  side: SpacingSide,
  value: number | undefined,
  mode: SpacingMode
): Partial<TailwindStyles> {
  if (mode === "xy") {
    const prefix = side === "x" ? "mx-" : "my-";
    const field = side === "x" ? "marginX" : "marginY";
    return { [field]: writeSpacing(value, prefix), margin: undefined } as Partial<TailwindStyles>;
  }
  // individual
  const fieldMap: Record<SpacingSide, [keyof TailwindStyles, string]> = {
    x: ["marginX", "mx-"],
    y: ["marginY", "my-"],
    top: ["marginTop", "mt-"],
    right: ["marginRight", "mr-"],
    bottom: ["marginBottom", "mb-"],
    left: ["marginLeft", "ml-"],
  };
  const [field, prefix] = fieldMap[side];
  return { [field]: writeSpacing(value, prefix) } as Partial<TailwindStyles>;
}

// ============================================================================
// Size Adapters
// Reads/Writes: width, height, minWidth, minHeight, maxWidth, maxHeight
// ============================================================================

/** Parse a Tailwind size class to a sections-v2 size string */
function parseSizeValue(value: string | undefined, prefix: string): string | undefined {
  if (!value) return undefined;
  if (value === `${prefix}full`) return "fill";
  if (value === `${prefix}auto`) return "auto";
  if (value === `${prefix}fit`) return "hug";
  // Viewport units: h-dvh, w-dvw, h-screen, w-screen, min-h-dvh, etc.
  if (value === `${prefix}dvh` || value === `${prefix}dvw` || value === `${prefix}screen`) return "viewport";
  // Arbitrary: w-[200px] or w-[12.5px] → "200" or "12.5"
  const arbMatch = value.match(/\[(-?[\d.]+)px\]/);
  if (arbMatch) return arbMatch[1];
  // Named spacing: w-96 → parse spacing to px
  const unit = value.slice(prefix.length);
  const px = SPACING_TO_PX[unit];
  if (px !== undefined) return String(px);
  // Raw number check
  const num = parseFloat(unit);
  if (!isNaN(num)) return String(num * 4); // Tailwind default: 1 unit = 4px
  return undefined;
}

/** Write a sections-v2 size string to a Tailwind size class */
function writeSizeValue(value: string | undefined, prefix: string): string | undefined {
  if (!value) return undefined;
  if (value === "fill") return `${prefix}full`;
  if (value === "auto") return `${prefix}auto`;
  if (value === "hug") return `${prefix}fit`;
  // Viewport: use dvh for height-axis prefixes, dvw for width-axis prefixes
  if (value === "viewport") return `${prefix}${prefix.includes("w") ? "dvw" : "dvh"}`;
  // Numeric → always use arbitrary pixel values for inline style extraction.
  // Named Tailwind classes (e.g. w-14) aren't available in JIT-compiled CSS
  // for dynamically-generated content. Arbitrary values (w-[56px]) get converted
  // to inline styles by extractArbitraryStyles().
  const px = parseFloat(value);
  if (isNaN(px)) return undefined;
  if (px === 0) return `${prefix}0`;
  return `${prefix}[${px}px]`;
}

export function readSize(styles: TailwindStyles) {
  return {
    width: parseSizeValue(styles.width, "w-") ?? "auto",
    height: parseSizeValue(styles.height, "h-") ?? "auto",
    minWidth: parseSizeValue(styles.minWidth, "min-w-"),
    minHeight: parseSizeValue(styles.minHeight, "min-h-"),
    maxWidth: parseSizeValue(styles.maxWidth, "max-w-"),
    maxHeight: parseSizeValue(styles.maxHeight, "max-h-"),
  };
}

export function writeWidth(value: string | undefined): Partial<TailwindStyles> {
  return { width: writeSizeValue(value, "w-") };
}

export function writeHeight(value: string | undefined): Partial<TailwindStyles> {
  return { height: writeSizeValue(value, "h-") };
}

export function writeMinWidth(value: string | undefined): Partial<TailwindStyles> {
  return { minWidth: value ? writeSizeValue(value, "min-w-") : undefined };
}

export function writeMinHeight(value: string | undefined): Partial<TailwindStyles> {
  return { minHeight: value ? writeSizeValue(value, "min-h-") : undefined };
}

export function writeMaxWidth(value: string | undefined): Partial<TailwindStyles> {
  // "0" means "no constraint" for max dimensions (max-width: 0px is never useful)
  if (!value || value === "0") return { maxWidth: undefined };
  return { maxWidth: writeSizeValue(value, "max-w-") };
}

export function writeMaxHeight(value: string | undefined): Partial<TailwindStyles> {
  // "0" means "no constraint" for max dimensions (max-height: 0px is never useful)
  if (!value || value === "0") return { maxHeight: undefined };
  return { maxHeight: writeSizeValue(value, "max-h-") };
}

// ============================================================================
// Position Adapters
// Reads/Writes: position, top, right, bottom, left, rotate, scaleX, scaleY
// ============================================================================

export function readPositionType(styles: TailwindStyles): PositionType {
  return (styles.position as PositionType) || "static";
}

export function writePositionType(type: PositionType): Partial<TailwindStyles> {
  const shouldClearConstraints = type === "static" || type === "relative" || type === "sticky";
  return {
    position: type === "static" ? undefined : type,
    ...(shouldClearConstraints && {
      top: type === "sticky" ? writeSpacing(0, "top-") : undefined,
      right: undefined,
      bottom: undefined,
      left: undefined,
    }),
  };
}

export function readConstraint(styles: TailwindStyles, side: "top" | "right" | "bottom" | "left"): number | undefined {
  const val = styles[side];
  if (!val) return undefined;
  return parseSpacing(val, `${side}-`);
}

export function writeConstraint(side: "top" | "right" | "bottom" | "left", value: number | undefined): Partial<TailwindStyles> {
  // Always use arbitrary bracket syntax (e.g. "left-[16px]" not "left-4")
  // because these values are stored in Yjs and rendered via extractArbitraryStyles,
  // which only handles bracket syntax — named classes aren't generated by Tailwind JIT.
  return { [side]: value !== undefined ? `${side}-[${value}px]` : undefined } as Partial<TailwindStyles>;
}

export function readPins(styles: TailwindStyles): PinState {
  return {
    top: styles.top !== undefined,
    right: styles.right !== undefined,
    bottom: styles.bottom !== undefined,
    left: styles.left !== undefined,
  };
}

export function readRotation(styles: TailwindStyles): number {
  const val = styles.rotate;
  if (!val) return 0;
  // Handle arbitrary: rotate-[37deg], rotate-[37.5deg], -rotate-[37deg], rotate-[-45deg]
  const arbMatch = val.match(/^(-?)rotate-\[(-?[\d.]+)deg\]$/);
  if (arbMatch) {
    const value = parseFloat(arbMatch[2]);
    return arbMatch[1] ? -value : value;
  }
  if (val.startsWith("-rotate-")) return -parseFloat(val.slice(8));
  if (val.startsWith("rotate-")) return parseFloat(val.slice(7));
  return 0;
}

const VALID_ROTATIONS = new Set([0, 1, 2, 3, 6, 12, 45, 90, 180]);

export function writeRotation(degrees: number): Partial<TailwindStyles> {
  if (degrees === 0) return { rotate: undefined };
  const abs = Math.abs(degrees);
  const neg = degrees < 0 ? "-" : "";
  if (VALID_ROTATIONS.has(abs)) return { rotate: `${neg}rotate-${abs}` };
  return { rotate: `${neg}rotate-[${abs}deg]` };
}

export function readFlipHorizontal(styles: TailwindStyles): boolean {
  return styles.scaleX === "-scale-x-100";
}

export function writeFlipHorizontal(flipped: boolean): Partial<TailwindStyles> {
  return { scaleX: flipped ? "-scale-x-100" : undefined };
}

export function readFlipVertical(styles: TailwindStyles): boolean {
  return styles.scaleY === "-scale-y-100";
}

export function writeFlipVertical(flipped: boolean): Partial<TailwindStyles> {
  return { scaleY: flipped ? "-scale-y-100" : undefined };
}

export function readStickyEdge(styles: TailwindStyles): StickyEdge {
  if (styles.top) return "top";
  if (styles.right) return "right";
  if (styles.bottom) return "bottom";
  if (styles.left) return "left";
  return "top";
}

export function readStickyValue(styles: TailwindStyles): number {
  const edge = readStickyEdge(styles);
  return readConstraint(styles, edge) ?? 0;
}

// ============================================================================
// Typography Adapters
// Reads/Writes: fontFamily, fontWeight, fontSize, lineHeight, letterSpacing,
//   textAlign, verticalAlign
// ============================================================================

export function readFontFamily(styles: TailwindStyles): string {
  return styles.fontFamily || "Inter";
}

export function writeFontFamily(value: string): Partial<TailwindStyles> {
  return { fontFamily: value };
}

export function readFontWeight(styles: TailwindStyles): string {
  const tw = styles.fontWeight || "font-normal";
  const num = FONT_WEIGHT_TO_NUM[tw];
  return num !== undefined ? String(num) : "400";
}

export function writeFontWeight(numericValue: string): Partial<TailwindStyles> {
  const num = parseInt(numericValue);
  const cls = NUM_TO_FONT_WEIGHT[num];
  return { fontWeight: cls || "font-normal" };
}

export function getFontWeightOptions(supportedWeights?: number[]): FontWeightOption[] {
  return Object.entries(FONT_WEIGHT_TO_NUM)
    .filter(([, num]) => !supportedWeights || supportedWeights.includes(num))
    .map(([cls, num]) => ({
      value: String(num),
      label: FONT_WEIGHT_LABELS[cls] || cls,
    }));
}

export function readFontSize(styles: TailwindStyles): string {
  const tw = styles.fontSize || "text-base";
  const px = FONT_SIZE_TO_PX[tw];
  if (px !== undefined) return String(px);
  // Parse arbitrary: text-[22px] → "22"
  const arbMatch = tw.match(/^text-\[([\d.]+)px\]$/);
  if (arbMatch) return arbMatch[1];
  return "16";
}

export function writeFontSize(pxString: string): Partial<TailwindStyles> {
  const px = parseInt(pxString);
  const cls = PX_TO_FONT_SIZE[px];
  return { fontSize: cls || `text-[${px}px]` };
}

export function readLineHeight(styles: TailwindStyles): string {
  const tw = styles.lineHeight;
  if (!tw) return "auto";
  const named = LINE_HEIGHT_TO_VALUE[tw];
  if (named) return named;
  // leading-N → px string
  const match = tw.match(/^leading-(\d+)$/);
  if (match) return String(parseInt(match[1]) * 4);
  // Parse arbitrary: leading-[24px] → "24"
  const arbMatch = tw.match(/^leading-\[([\d.]+)px\]$/);
  if (arbMatch) return arbMatch[1];
  return "auto";
}

export function writeLineHeight(value: string): Partial<TailwindStyles> {
  if (value === "auto") return { lineHeight: "leading-normal" };
  // Check if it's a named value
  for (const [cls, display] of Object.entries(LINE_HEIGHT_TO_VALUE)) {
    if (display === value) return { lineHeight: cls };
  }
  // Numeric px → leading-N if exact multiple of 4, otherwise arbitrary
  const px = parseFloat(value);
  if (!isNaN(px)) {
    if (px % 4 === 0) {
      return { lineHeight: `leading-${px / 4}` };
    }
    return { lineHeight: `leading-[${px}px]` };
  }
  return { lineHeight: "leading-normal" };
}

export function readLetterSpacing(styles: TailwindStyles): string {
  const tw = styles.letterSpacing;
  if (!tw) return "0%";

  // Backwards compatibility: handle named classes (e.g. "tracking-wide")
  if (LETTER_SPACING_TO_PERCENT[tw]) {
    return LETTER_SPACING_TO_PERCENT[tw];
  }

  // Parse arbitrary format: "tracking-[0.025em]" or "tracking-[-0.05em]"
  const arbMatch = tw.match(/^tracking-\[(-?[\d.]+)em\]$/);
  if (arbMatch) {
    const em = parseFloat(arbMatch[1]);
    const pct = em * 100;
    // Round to avoid floating-point artifacts (e.g. 2.4999... → 2.5)
    const rounded = Math.round(pct * 1000) / 1000;
    return `${rounded}%`;
  }

  return "0%";
}

export function writeLetterSpacing(percentValue: string): Partial<TailwindStyles> {
  const pct = parseFloat(percentValue);
  if (isNaN(pct) || pct === 0) {
    return { letterSpacing: undefined };
  }
  const em = pct / 100;
  return { letterSpacing: `tracking-[${em}em]` };
}

export function readTextAlign(styles: TailwindStyles): TextAlignment {
  const tw = styles.textAlign;
  if (tw === "text-center") return "center";
  if (tw === "text-right") return "right";
  if (tw === "text-justify") return "justify";
  return "left";
}

export function writeTextAlign(value: TextAlignment): Partial<TailwindStyles> {
  const map: Record<TextAlignment, string> = {
    left: "text-left", center: "text-center", right: "text-right", justify: "text-justify",
  };
  return { textAlign: map[value] };
}

export function readVerticalAlign(styles: TailwindStyles): VerticalAlignment {
  const jc = styles.justifyContent;
  if (jc === "justify-center") return "middle";
  if (jc === "justify-end") return "bottom";
  return "top";
}

export function writeVerticalAlign(value: VerticalAlignment): Partial<TailwindStyles> {
  const map: Record<VerticalAlignment, string> = {
    top: "justify-start", middle: "justify-center", bottom: "justify-end",
  };
  return {
    display: "flex",
    flexDirection: "flex-col",
    justifyContent: map[value],
    verticalAlign: undefined,
  };
}


// ============================================================================
// Text Formatting Adapters
// Reads/Writes: textDecoration, textTransform, textWrap, listStyleType, lineClamp
// ============================================================================

export type TextDecorationValue = "none" | "underline" | "line-through";
export type TextTransformValue = "none" | "uppercase" | "lowercase" | "capitalize";
export type TextWrapValue = "wrap" | "nowrap" | "balance" | "pretty";
export type ListStyleValue = "none" | "disc" | "decimal";

export function readTextDecoration(styles: TailwindStyles): TextDecorationValue {
  const tw = styles.textDecoration;
  if (tw === "underline") return "underline";
  if (tw === "line-through") return "line-through";
  return "none";
}

export function writeTextDecoration(value: TextDecorationValue): Partial<TailwindStyles> {
  if (value === "none") return { textDecoration: undefined };
  return { textDecoration: value };
}

export type FontStyleValue = "normal" | "italic";

export function readFontStyle(styles: TailwindStyles): FontStyleValue {
  return styles.fontStyle === "italic" ? "italic" : "normal";
}

export function writeFontStyle(value: FontStyleValue): Partial<TailwindStyles> {
  if (value === "normal") return { fontStyle: undefined };
  return { fontStyle: "italic" };
}

export function readTextTransform(styles: TailwindStyles): TextTransformValue {
  const tw = styles.textTransform;
  if (tw === "uppercase") return "uppercase";
  if (tw === "lowercase") return "lowercase";
  if (tw === "capitalize") return "capitalize";
  return "none";
}

export function writeTextTransform(value: TextTransformValue): Partial<TailwindStyles> {
  if (value === "none") return { textTransform: undefined };
  return { textTransform: value };
}

export function readTextWrap(styles: TailwindStyles): TextWrapValue {
  const tw = styles.textWrap;
  if (tw === "text-nowrap") return "nowrap";
  if (tw === "text-balance") return "balance";
  if (tw === "text-pretty") return "pretty";
  return "wrap";
}

export function writeTextWrap(value: TextWrapValue): Partial<TailwindStyles> {
  if (value === "wrap") return { textWrap: undefined };
  const map: Record<TextWrapValue, string> = {
    wrap: "text-wrap",
    nowrap: "text-nowrap",
    balance: "text-balance",
    pretty: "text-pretty",
  };
  return { textWrap: map[value] };
}

export function readListStyleType(styles: TailwindStyles): ListStyleValue {
  const tw = styles.listStyleType;
  if (tw === "list-disc") return "disc";
  if (tw === "list-decimal") return "decimal";
  return "none";
}

export function writeListStyleType(value: ListStyleValue): Partial<TailwindStyles> {
  if (value === "none") return { listStyleType: undefined, display: undefined };
  const map: Record<string, string> = {
    disc: "list-disc",
    decimal: "list-decimal",
  };
  return { listStyleType: map[value], display: "list-item" };
}

export function readLineClamp(styles: TailwindStyles): number | undefined {
  const tw = styles.lineClamp;
  if (!tw) return undefined;
  const match = tw.match(/^line-clamp-(\d+)$/);
  if (match) return parseInt(match[1], 10);
  return undefined;
}

export function writeLineClamp(value: number | undefined): Partial<TailwindStyles> {
  if (value === undefined) return { lineClamp: undefined };
  return { lineClamp: `line-clamp-${value}` };
}
// ============================================================================
// Appearance Adapters
// Reads/Writes: opacity, mixBlendMode, zIndex, borderRadius,
//   borderRadiusTopLeft/TopRight/BottomRight/BottomLeft, overflow, overflowX, overflowY
// ============================================================================

export function readOpacity(styles: TailwindStyles): number {
  const tw = styles.opacity;
  if (!tw) return 100;
  // Handle arbitrary: opacity-[0.37]
  const arbMatch = tw.match(/^opacity-\[([0-9.]+)\]$/);
  if (arbMatch) return Math.round(parseFloat(arbMatch[1]) * 100);
  const match = tw.match(/^opacity-(\d+)$/);
  return match ? parseInt(match[1]) : 100;
}

export function writeOpacity(value: number): Partial<TailwindStyles> {
  // Clamp to valid range [0, 100]
  const clamped = Math.max(0, Math.min(100, value));
  if (clamped >= 100) return { opacity: undefined };
  // Tailwind has preset opacity classes for multiples of 5
  if (clamped % 5 === 0) return { opacity: `opacity-${clamped}` };
  return { opacity: `opacity-[${clamped / 100}]` };
}

export function readBlendMode(styles: TailwindStyles): BlendMode {
  const tw = styles.mixBlendMode;
  if (!tw) return "normal";
  return tw.replace("mix-blend-", "") as BlendMode;
}

export function writeBlendMode(value: BlendMode): Partial<TailwindStyles> {
  if (value === "normal") return { mixBlendMode: undefined };
  return { mixBlendMode: `mix-blend-${value}` };
}

export function readZIndex(styles: TailwindStyles): string {
  const tw = styles.zIndex;
  if (!tw) return "auto";
  // Handle positive: z-10, z-auto
  const match = tw.match(/^z-(\d+|auto)$/);
  if (match) return match[1];
  // Handle negative: -z-10
  const negMatch = tw.match(/^-z-(\d+)$/);
  if (negMatch) return `-${negMatch[1]}`;
  // Handle negative arbitrary: -z-[10]
  const negArbMatch = tw.match(/^-z-\[(\d+)\]$/);
  if (negArbMatch) return `-${negArbMatch[1]}`;
  // Handle arbitrary: z-[100], z-[-5]
  const arbMatch = tw.match(/^z-\[(-?\d+)\]$/);
  if (arbMatch) return arbMatch[1];
  return "auto";
}

const STANDARD_Z_VALUES = new Set(["0", "10", "20", "30", "40", "50", "auto"]);

export function writeZIndex(value: string | undefined): Partial<TailwindStyles> {
  if (!value || value === "") return { zIndex: undefined };
  if (STANDARD_Z_VALUES.has(value)) return { zIndex: `z-${value}` };
  // Negative values
  if (value.startsWith("-")) return { zIndex: `-z-[${value.slice(1)}]` };
  // Arbitrary positive values
  return { zIndex: `z-[${value}]` };
}

export function readCornerRadius(styles: TailwindStyles): string {
  const tw = styles.borderRadius;
  if (!tw) return "0";
  const px = BORDER_RADIUS_TO_PX[tw];
  if (px !== undefined) return String(px);
  // Parse arbitrary: rounded-[10px] → "10"
  const arbMatch = tw.match(/^rounded-\[([\d.]+)px\]$/);
  if (arbMatch) return arbMatch[1];
  return "0";
}

export function writeCornerRadius(value: string | undefined): Partial<TailwindStyles> {
  if (!value) return { borderRadius: undefined };
  const px = parseInt(value);
  const cls = PX_TO_BORDER_RADIUS[px];
  return { borderRadius: cls || `rounded-[${px}px]` };
}

export function readIndividualCornerRadius(styles: TailwindStyles, corner: "TopLeft" | "TopRight" | "BottomLeft" | "BottomRight"): string {
  const field = `borderRadius${corner}` as keyof TailwindStyles;
  const tw = styles[field] as string | undefined;
  if (!tw) {
    // Fall back to shared borderRadius value so individual corners inherit it
    return readCornerRadius(styles);
  }
  return parseCornerRadius(tw) ?? "0";
}

export function writeIndividualCornerRadius(
  corner: "TopLeft" | "TopRight" | "BottomLeft" | "BottomRight",
  value: string | undefined
): Partial<TailwindStyles> {
  const field = `borderRadius${corner}` as keyof TailwindStyles;
  if (!value) return { [field]: undefined } as Partial<TailwindStyles>;
  const px = parseInt(value);
  const cls = PX_TO_BORDER_RADIUS[px];
  const prefix = corner === "TopLeft" ? "rounded-tl" : corner === "TopRight" ? "rounded-tr" : corner === "BottomLeft" ? "rounded-bl" : "rounded-br";
  const suffix = cls ? cls.replace("rounded", "") : `-[${px}px]`;
  return { [field]: `${prefix}${suffix}` } as Partial<TailwindStyles>;
}

export function readOverflow(styles: TailwindStyles): OverflowValue {
  const tw = styles.overflow;
  if (!tw) return "visible";
  return tw.replace("overflow-", "") as OverflowValue;
}

export function writeOverflow(value: OverflowValue): Partial<TailwindStyles> {
  if (value === "visible") return { overflow: undefined };
  return { overflow: `overflow-${value}` };
}

export function readOverflowAxis(styles: TailwindStyles, axis: "X" | "Y"): OverflowValue {
  const field = axis === "X" ? "overflowX" : "overflowY";
  const tw = styles[field as keyof TailwindStyles] as string | undefined;
  if (!tw) return readOverflow(styles); // fallback to shared overflow
  return tw.replace(`overflow-${axis.toLowerCase()}-`, "") as OverflowValue;
}

export function writeOverflowAxis(axis: "X" | "Y", value: OverflowValue): Partial<TailwindStyles> {
  const field = axis === "X" ? "overflowX" : "overflowY";
  if (value === "visible") return { [field]: undefined } as Partial<TailwindStyles>;
  return { [field]: `overflow-${axis.toLowerCase()}-${value}` } as Partial<TailwindStyles>;
}

// ============================================================================
// Fill Adapters (Phase 1 — basic: single backgroundColor)
// Reads/Writes: backgroundColor
// ============================================================================

// Maps Tailwind v4 gradient direction classes to angles (degrees)
const GRADIENT_DIRECTION_TO_ANGLE: Record<string, number> = {
  "bg-linear-to-t": 0,
  "bg-linear-to-tr": 45,
  "bg-linear-to-r": 90,
  "bg-linear-to-br": 135,
  "bg-linear-to-b": 180,
  "bg-linear-to-bl": 225,
  "bg-linear-to-l": 270,
  "bg-linear-to-tl": 315,
};

// Reverse map: angle to Tailwind v4 direction class
const ANGLE_TO_GRADIENT_DIRECTION: Record<number, string> = Object.fromEntries(
  Object.entries(GRADIENT_DIRECTION_TO_ANGLE).map(([k, v]) => [v, k])
);

/** Parse a gradient color class (from-[#xxx], via-[#xxx], to-[#xxx]) back to hex and optional opacity */
export function parseGradientColorClass(cls: string | undefined, prefix: string): { color: string; opacity?: number } | undefined {
  if (!cls) return undefined;
  // e.g. "from-[#ff0000]/50" → { color: "#ff0000", opacity: 50 }
  const stripped = cls.replace(`${prefix}-`, "");
  // Check for opacity modifier: e.g. "[#ff0000]/50" or "red-500/50"
  const opacityMatch = stripped.match(/^(.+?)\/(\d+)$/);
  const colorPart = opacityMatch ? opacityMatch[1] : stripped;
  const opacity = opacityMatch ? parseInt(opacityMatch[2]) : undefined;
  const color = colorPart.startsWith("[") && colorPart.endsWith("]") ? colorPart.slice(1, -1) : colorPart;
  return { color, opacity };
}

/** Build a gradient color class from a hex color: e.g. "#ff0000" → "from-[#ff0000]", with optional opacity → "from-[#ff0000]/50" */
export function buildGradientColorClass(prefix: string, color: string, opacity?: number): string {
  const opacitySuffix = opacity !== undefined && opacity < 100 ? `/${opacity}` : "";
  if (color.startsWith("#")) return `${prefix}-[${color}]${opacitySuffix}`;
  return `${prefix}-${color}${opacitySuffix}`;
}

/** Convert a gradient direction class to its type and angle */
export function parseGradientDirection(cls: string): { type: GradientFill["type"]; angle: number } {
  // Check named directions first
  if (cls in GRADIENT_DIRECTION_TO_ANGLE) {
    return { type: "linear", angle: GRADIENT_DIRECTION_TO_ANGLE[cls] };
  }
  // Arbitrary angle: bg-linear-[45deg]
  const arbitraryMatch = cls.match(/^bg-linear-\[(\d+)deg\]$/);
  if (arbitraryMatch) {
    return { type: "linear", angle: parseInt(arbitraryMatch[1]) };
  }
  if (cls === "bg-radial") return { type: "radial", angle: 0 };
  if (cls === "bg-conic") return { type: "conic", angle: 0 };
  // Conic with angle: bg-conic-[from_Ndeg]
  const conicMatch = cls.match(/^bg-conic-\[from[_ ](\d+)deg\]$/);
  if (conicMatch) return { type: "conic", angle: parseInt(conicMatch[1]) };
  // Fallback
  return { type: "linear", angle: 180 };
}

/** Convert a gradient type + angle to a Tailwind v4 direction class */
export function buildGradientDirection(type: GradientFill["type"], angle: number): string {
  if (type === "radial") return "bg-radial";
  if (type === "conic") return angle ? `bg-conic-[from_${angle}deg]` : "bg-conic";
  // Check if angle matches a named direction
  if (angle in ANGLE_TO_GRADIENT_DIRECTION) {
    return ANGLE_TO_GRADIENT_DIRECTION[angle];
  }
  // Arbitrary angle
  return `bg-linear-[${angle}deg]`;
}

export function readFills(styles: TailwindStyles): FillItem[] {
  // Multi-fill path: if backgroundFills exists, parse and return all fills
  if (styles.backgroundFills) {
    try {
      const parsed = JSON.parse(styles.backgroundFills) as Array<{ color: string; opacity: number; visible: boolean; gradient?: FillItem['gradient'] }>;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((f, i) => ({
          id: `fill-bg-${i}`,
          color: f.color,
          opacity: f.opacity,
          visible: f.visible,
          ...(f.gradient ? { gradient: f.gradient } : {}),
        }));
      }
    } catch { /* fall through to single-fill logic */ }
  }

  // Single-fill backwards compatibility path
  const bg = styles.backgroundColor;
  if (!bg) return [];
  const rawFillColor = bg.replace("bg-", "");
  // Parse Tailwind opacity modifier: e.g., "blue-500/50" or "[#ff0000]/75"
  const opacityMatch = rawFillColor.match(/^(.+?)\/(\d+)$/);
  const colorPart = opacityMatch ? opacityMatch[1] : rawFillColor;
  const opacity = opacityMatch ? parseInt(opacityMatch[2]) : 100;
  const fillColor = colorPart.startsWith("[") && colorPart.endsWith("]") ? colorPart.slice(1, -1) : colorPart;

  const item: FillItem = {
    id: `fill-bg-0`,
    color: fillColor,
    opacity,
    visible: styles.backgroundVisible !== false,
  };

  // Reconstruct gradient if gradient fields are present
  if (styles.backgroundGradient && styles.gradientFrom && styles.gradientTo) {
    const { type, angle } = parseGradientDirection(styles.backgroundGradient);

    // Prefer full-fidelity gradientStops JSON when available
    if (styles.gradientStops) {
      try {
        const stops: GradientStop[] = JSON.parse(styles.gradientStops);
        if (Array.isArray(stops) && stops.length >= 2) {
          item.gradient = { type, angle, stops };
          return [item];
        }
      } catch { /* fall through to from/via/to reconstruction */ }
    }

    // Fallback: reconstruct from from/via/to classes
    const fromParsed = parseGradientColorClass(styles.gradientFrom, "from");
    const toParsed = parseGradientColorClass(styles.gradientTo, "to");
    if (fromParsed && toParsed) {
      const stops: GradientStop[] = [
        { color: fromParsed.color, position: 0, ...(fromParsed.opacity !== undefined && fromParsed.opacity !== 100 ? { opacity: fromParsed.opacity } : {}) },
      ];
      if (styles.gradientVia) {
        const viaParsed = parseGradientColorClass(styles.gradientVia, "via");
        if (viaParsed) {
          stops.push({ color: viaParsed.color, position: 0.5, ...(viaParsed.opacity !== undefined && viaParsed.opacity !== 100 ? { opacity: viaParsed.opacity } : {}) });
        }
      }
      stops.push({ color: toParsed.color, position: 1, ...(toParsed.opacity !== undefined && toParsed.opacity !== 100 ? { opacity: toParsed.opacity } : {}) });
      item.gradient = { type, angle, stops };
    }
  }

  return [item];
}

export function writeFills(fills: FillItem[]): Partial<TailwindStyles> {
  if (fills.length === 0) return { backgroundColor: undefined, backgroundVisible: undefined, backgroundGradient: undefined, gradientFrom: undefined, gradientVia: undefined, gradientTo: undefined, gradientStops: undefined, backgroundFills: undefined };
  const fill = fills[0];
  const opacitySuffix = fill.opacity < 100 ? `/${Math.round(fill.opacity)}` : "";
  const color = fill.color.startsWith("bg-") ? fill.color
    : fill.color.startsWith("#") ? `bg-[${fill.color}]${opacitySuffix}`
    : `bg-${fill.color}${opacitySuffix}`;

  const result: Partial<TailwindStyles> = {
    backgroundColor: color,
    backgroundVisible: fill.visible === false ? false : undefined,
  };

  if (fill.gradient) {
    const { type, angle, stops } = fill.gradient;
    result.backgroundGradient = buildGradientDirection(type, angle);
    // First stop → from, last stop → to
    result.gradientFrom = buildGradientColorClass("from", stops[0].color, stops[0].opacity);
    result.gradientTo = buildGradientColorClass("to", stops[stops.length - 1].color, stops[stops.length - 1].opacity);
    // Middle stop → via (if 3+ stops, use the second stop)
    if (stops.length >= 3) {
      result.gradientVia = buildGradientColorClass("via", stops[1].color, stops[1].opacity);
    } else {
      result.gradientVia = undefined;
    }
    // Store full stops array for round-trip fidelity (positions, 4+ stops, opacity)
    result.gradientStops = JSON.stringify(stops);
  } else {
    // Explicitly clear gradient fields for solid fills
    result.backgroundGradient = undefined;
    result.gradientFrom = undefined;
    result.gradientVia = undefined;
    result.gradientTo = undefined;
    result.gradientStops = undefined;
  }

  // Multi-fill: store all fills as JSON when there are multiple
  if (fills.length > 1) {
    result.backgroundFills = JSON.stringify(fills.map(f => ({ color: f.color, opacity: f.opacity, visible: f.visible, gradient: f.gradient })));
  } else {
    result.backgroundFills = undefined;
  }

  return result;
}

// Text Fill Adapters — maps Fill UI to textColor for text elements
// Reads/Writes: textColor

export function readTextFills(styles: TailwindStyles): FillItem[] {
  // Prefer textColor; fall back to backgroundColor for migration from older data
  const tc = styles.textColor;
  const fallback = !tc ? styles.backgroundColor : undefined;
  const raw = tc ?? fallback;
  if (!raw) return [];
  const stripped = tc ? raw.replace("text-", "") : raw.replace("bg-", "");
  // Parse Tailwind opacity modifier
  const opacityMatch = stripped.match(/^(.+?)\/(\d+)$/);
  const colorPart = opacityMatch ? opacityMatch[1] : stripped;
  const opacity = opacityMatch ? parseInt(opacityMatch[2]) : 100;
  const color = colorPart.startsWith("[") && colorPart.endsWith("]") ? colorPart.slice(1, -1) : colorPart;
  const item: FillItem = {
    id: `fill-text-0`,
    color,
    opacity,
    visible: styles.textColorVisible !== false,
  };
  // Parse text gradient if present
  if (styles.textGradient) {
    try {
      item.gradient = JSON.parse(styles.textGradient) as GradientFill;
    } catch { /* ignore bad JSON */ }
  }
  return [item];
}

export function writeTextFills(fills: FillItem[]): Partial<TailwindStyles> {
  // Always clear backgroundColor to clean up stale values from before text-fill migration
  if (fills.length === 0) return { textColor: undefined, backgroundColor: undefined, textColorVisible: undefined, textGradient: undefined };
  const fill = fills[0];
  const opacitySuffix = fill.opacity < 100 ? `/${Math.round(fill.opacity)}` : "";
  const color = fill.color.startsWith("text-") ? fill.color
    : fill.color.startsWith("#") ? `text-[${fill.color}]${opacitySuffix}`
    : `text-${fill.color}${opacitySuffix}`;
  // Serialize gradient if present, clear if not
  const textGradient = fill.gradient ? JSON.stringify(fill.gradient) : undefined;
  if (fill.visible === false) {
    return { textColor: color, backgroundColor: undefined, textColorVisible: false, textGradient };
  }
  return { textColor: color, backgroundColor: undefined, textColorVisible: undefined, textGradient };
}

// ============================================================================
// Border Adapters
// Reads/Writes: borderWidth, borderColor, borderStyle,
//   borderWidthTop, borderWidthRight, borderWidthBottom, borderWidthLeft
// ============================================================================

export function readBorder(styles: TailwindStyles): BorderValue | null {
  const widthVal = styles.borderWidth;
  if (!widthVal) return null;

  // Parse border width: named lookup or arbitrary bracket value
  let width = BORDER_WIDTH_TO_PX[widthVal];
  if (width === undefined) {
    const arbMatch = widthVal.match(/\[([\d.]+)px\]/);
    width = arbMatch ? parseFloat(arbMatch[1]) : 1;
  }
  const rawColor = styles.borderColor ? styles.borderColor.replace("border-", "") : "#000000";
  // Extract opacity modifier (e.g., "[#ff0000]/50" or "red-500/50")
  let opacity = 100;
  let colorPart = rawColor;
  const opacityMatch = rawColor.match(/\/(\d+)$/);
  if (opacityMatch) {
    opacity = parseInt(opacityMatch[1], 10);
    colorPart = rawColor.slice(0, -opacityMatch[0].length);
  }
  const color = colorPart.startsWith("[") && colorPart.endsWith("]") ? colorPart.slice(1, -1) : colorPart;
  const style: BorderStyle = styles.borderStyle === "border-dashed" ? "dashed" : "solid";

  // Determine side
  let side: BorderSide = "all";
  if (styles.borderWidthTop && !styles.borderWidthRight && !styles.borderWidthBottom && !styles.borderWidthLeft) side = "top";
  else if (!styles.borderWidthTop && styles.borderWidthRight && !styles.borderWidthBottom && !styles.borderWidthLeft) side = "right";
  else if (!styles.borderWidthTop && !styles.borderWidthRight && styles.borderWidthBottom && !styles.borderWidthLeft) side = "bottom";
  else if (!styles.borderWidthTop && !styles.borderWidthRight && !styles.borderWidthBottom && styles.borderWidthLeft) side = "left";

  return { color, opacity, width, style, side };
}

export function writeBorder(border: BorderValue | null): Partial<TailwindStyles> {
  if (!border) {
    return {
      borderWidth: undefined, borderColor: undefined, borderStyle: undefined,
      borderWidthTop: undefined, borderWidthRight: undefined,
      borderWidthBottom: undefined, borderWidthLeft: undefined,
    };
  }

  const validBorderWidths = new Set([0, 2, 4, 8]);
  const borderWidthClass = (prefix: string, w: number) => {
    if (w === 0) return `${prefix}-0`;
    if (w === 1) return prefix; // "border" or "border-t" etc.
    if (validBorderWidths.has(w)) return `${prefix}-${w}`;
    return `${prefix}-[${w}px]`;
  };

  const widthCls = borderWidthClass("border", border.width);
  const opacitySuffix = border.opacity < 100 ? `/${border.opacity}` : "";
  const colorCls = border.color.startsWith("border-") ? `${border.color}${opacitySuffix}`
    : border.color.startsWith("#") ? `border-[${border.color}]${opacitySuffix}`
    : `border-${border.color}${opacitySuffix}`;
  const styleCls = border.style === "dashed" ? "border-dashed" : "border-solid";

  const result: Partial<TailwindStyles> = {
    borderColor: colorCls,
    borderStyle: styleCls,
    borderWidthTop: undefined,
    borderWidthRight: undefined,
    borderWidthBottom: undefined,
    borderWidthLeft: undefined,
  };

  if (border.side === "all") {
    result.borderWidth = widthCls;
  } else {
    result.borderWidth = undefined;
    const sidePrefix = border.side === "top" ? "border-t" : border.side === "right" ? "border-r" : border.side === "bottom" ? "border-b" : "border-l";
    const sideField = `borderWidth${border.side.charAt(0).toUpperCase() + border.side.slice(1)}` as keyof TailwindStyles;
    const sideWidthCls = borderWidthClass(sidePrefix, border.width);
    (result as Record<string, unknown>)[sideField] = sideWidthCls;
  }

  return result;
}

// ============================================================================
// Shadow Adapters (Phase 1 — preset mapping + color/opacity)
// Reads/Writes: shadow, shadowColor, insetShadow, insetShadowColor
// ============================================================================

/**
 * Parse a shadow color class like "shadow-[#ff0000]/50" or "inset-shadow-[#00ff00]"
 * Returns { color, opacity } or null if unparseable.
 */
export function parseShadowColorClass(cls: string): { color: string; opacity: number } | null {
  // Match: (shadow|inset-shadow)-[#hex](/opacity)?
  const match = cls.match(/^(?:shadow|inset-shadow)-\[#([0-9a-fA-F]{3,8})\](?:\/(\d+))?$/);
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const color = `#${hex.toLowerCase()}`;
  const opacity = match[2] !== undefined ? parseInt(match[2]) : 100;
  return { color, opacity };
}

/**
 * Build a shadow color class from color and opacity.
 * prefix is "shadow" or "inset-shadow".
 */
export function buildShadowColorClass(prefix: string, color: string, opacity: number): string {
  const cls = `${prefix}-[${color}]`;
  if (opacity !== 100) {
    return `${cls}/${opacity}`;
  }
  return cls;
}

export function readShadow(styles: TailwindStyles): ShadowValue | null {
  const outsideShadow = styles.shadow;
  const insideShadow = styles.insetShadow;

  let base: ShadowValue | null = null;

  if (insideShadow && insideShadow !== "inset-shadow-none") {
    const preset = INSET_SHADOW_PRESETS[insideShadow];
    if (!preset) return null;
    base = { ...preset };
  } else if (outsideShadow && outsideShadow !== "shadow-none") {
    const preset = SHADOW_PRESETS[outsideShadow];
    if (!preset) return null;
    base = { ...preset };
  }

  if (!base) return null;

  // Apply custom value overrides
  const isInset = base.type === "inside";
  const angleStr = isInset ? styles.insetShadowAngle : styles.shadowAngle;
  const distStr = isInset ? styles.insetShadowDistance : styles.shadowDistance;
  const brightStr = isInset ? styles.insetShadowBrightness : styles.shadowBrightness;
  const elevStr = isInset ? styles.insetShadowElevation : styles.shadowElevation;

  if (angleStr !== undefined) base.angle = parseFloat(angleStr);
  if (distStr !== undefined) base.distance = parseFloat(distStr);
  if (brightStr !== undefined) base.brightness = parseFloat(brightStr);
  if (elevStr !== undefined) base.elevation = parseFloat(elevStr);

  // Check for color overrides
  const colorClass = isInset ? styles.insetShadowColor : styles.shadowColor;
  if (colorClass) {
    const parsed = parseShadowColorClass(colorClass);
    if (parsed) {
      base.color = parsed.color;
      base.opacity = parsed.opacity;
    }
  }

  return base;
}

export function writeShadow(shadow: ShadowValue | null): Partial<TailwindStyles> {
  if (!shadow) return {
    shadow: undefined, shadowColor: undefined,
    insetShadow: undefined, insetShadowColor: undefined,
    shadowAngle: undefined, shadowDistance: undefined, shadowBrightness: undefined, shadowElevation: undefined,
    insetShadowAngle: undefined, insetShadowDistance: undefined, insetShadowBrightness: undefined, insetShadowElevation: undefined,
  };

  // Find the closest preset by elevation + distance (for backward compatibility)
  const presets = shadow.type === "inside" ? INSET_SHADOW_PRESETS : SHADOW_PRESETS;
  let bestKey = shadow.type === "inside" ? "inset-shadow" : "shadow";
  let bestDist = Infinity;

  for (const [key, preset] of Object.entries(presets)) {
    const dist = Math.abs(preset.elevation - shadow.elevation) + Math.abs(preset.distance - shadow.distance);
    if (dist < bestDist) {
      bestDist = dist;
      bestKey = key;
    }
  }

  // Determine if we need a color class
  const matchedPreset = presets[bestKey];
  const colorPrefix = shadow.type === "inside" ? "inset-shadow" : "shadow";
  let colorClass: string | undefined;

  if (shadow.color !== matchedPreset.color || shadow.opacity !== matchedPreset.opacity) {
    colorClass = buildShadowColorClass(colorPrefix, shadow.color, shadow.opacity);
  }

  // Store custom values as string overrides
  const angleStr = String(shadow.angle);
  const distanceStr = String(shadow.distance);
  const brightnessStr = String(shadow.brightness);
  const elevationStr = String(shadow.elevation);

  if (shadow.type === "inside") {
    return {
      shadow: undefined, shadowColor: undefined,
      shadowAngle: undefined, shadowDistance: undefined, shadowBrightness: undefined, shadowElevation: undefined,
      insetShadow: bestKey, insetShadowColor: colorClass,
      insetShadowAngle: angleStr, insetShadowDistance: distanceStr,
      insetShadowBrightness: brightnessStr, insetShadowElevation: elevationStr,
    };
  }
  return {
    shadow: bestKey, shadowColor: colorClass,
    shadowAngle: angleStr, shadowDistance: distanceStr,
    shadowBrightness: brightnessStr, shadowElevation: elevationStr,
    insetShadow: undefined, insetShadowColor: undefined,
    insetShadowAngle: undefined, insetShadowDistance: undefined,
    insetShadowBrightness: undefined, insetShadowElevation: undefined,
  };
}

// ============================================================================
// Filter Adapters
// Reads/Writes: blur, backdropBlur, brightness, contrast, hueRotate, invert,
//   saturate, sepia, backdropBrightness, backdropContrast, backdropHueRotate,
//   backdropInvert, backdropSaturate, backdropSepia
// ============================================================================

interface FilterMapping {
  field: keyof TailwindStyles;
  type: FilterType;
  target: FilterTarget;
  prefix: string;
  parseValue: (cls: string) => string;
}

const FILTER_MAPPINGS: FilterMapping[] = [
  { field: "blur", type: "blur", target: "layer", prefix: "blur-", parseValue: (c) => { const n = BLUR_TO_PX[c]; if (n !== undefined) return String(n); const m = c.match(/\[([\d.]+)px\]/); return m ? m[1] : "0"; } },
  { field: "backdropBlur", type: "blur", target: "backdrop", prefix: "backdrop-blur-", parseValue: (c) => { const n = BACKDROP_BLUR_TO_PX[c]; if (n !== undefined) return String(n); const m = c.match(/\[([\d.]+)px\]/); return m ? m[1] : "0"; } },
  { field: "brightness", type: "brightness", target: "layer", prefix: "brightness-", parseValue: (c) => c.replace("brightness-", "") },
  { field: "contrast", type: "contrast", target: "layer", prefix: "contrast-", parseValue: (c) => c.replace("contrast-", "") },
  { field: "hueRotate", type: "hueRotate", target: "layer", prefix: "hue-rotate-", parseValue: (c) => c.replace("hue-rotate-", "") },
  { field: "invert", type: "invert", target: "layer", prefix: "invert", parseValue: (c) => { if (c === "invert") return "100"; const m = c.match(/^invert-(\d+)$/); return m ? m[1] : "0"; } },
  { field: "saturate", type: "saturate", target: "layer", prefix: "saturate-", parseValue: (c) => c.replace("saturate-", "") },
  { field: "sepia", type: "sepia", target: "layer", prefix: "sepia", parseValue: (c) => { if (c === "sepia") return "100"; const m = c.match(/^sepia-(\d+)$/); return m ? m[1] : "0"; } },
  { field: "backdropBrightness", type: "brightness", target: "backdrop", prefix: "backdrop-brightness-", parseValue: (c) => c.replace("backdrop-brightness-", "") },
  { field: "backdropContrast", type: "contrast", target: "backdrop", prefix: "backdrop-contrast-", parseValue: (c) => c.replace("backdrop-contrast-", "") },
  { field: "backdropHueRotate", type: "hueRotate", target: "backdrop", prefix: "backdrop-hue-rotate-", parseValue: (c) => c.replace("backdrop-hue-rotate-", "") },
  { field: "backdropInvert", type: "invert", target: "backdrop", prefix: "backdrop-invert", parseValue: (c) => { if (c === "backdrop-invert") return "100"; const m = c.match(/^backdrop-invert-(\d+)$/); return m ? m[1] : "0"; } },
  { field: "backdropSaturate", type: "saturate", target: "backdrop", prefix: "backdrop-saturate-", parseValue: (c) => c.replace("backdrop-saturate-", "") },
  { field: "backdropSepia", type: "sepia", target: "backdrop", prefix: "backdrop-sepia", parseValue: (c) => { if (c === "backdrop-sepia") return "100"; const m = c.match(/^backdrop-sepia-(\d+)$/); return m ? m[1] : "0"; } },
];

export function readFilters(styles: TailwindStyles): FilterItem[] {
  const items: FilterItem[] = [];

  // Parse hidden filter keys
  let hiddenKeys: string[] = [];
  if (styles.hiddenFilters) {
    try { hiddenKeys = JSON.parse(styles.hiddenFilters); } catch { /* ignore */ }
  }

  for (const mapping of FILTER_MAPPINGS) {
    const cls = styles[mapping.field] as string | undefined;
    if (!cls) continue;
    // Skip "none" values but keep explicit zero values for filters like hue-rotate-0, invert-0, sepia-0
    if (cls.endsWith("-none")) continue;

    const key = `${mapping.target}-${mapping.type}`;
    items.push({
      id: `filter-${mapping.target}-${mapping.type}`,
      type: mapping.type,
      value: mapping.parseValue(cls),
      target: mapping.target,
      visible: !hiddenKeys.includes(key),
    });
  }

  return items;
}

export function writeFilters(filters: FilterItem[]): Partial<TailwindStyles> {
  // Start with all filter fields cleared
  const result: Partial<TailwindStyles> = {};
  for (const m of FILTER_MAPPINGS) {
    (result as Record<string, unknown>)[m.field] = undefined;
  }

  // Track hidden filters
  const hiddenKeys: string[] = [];
  for (const filter of filters) {
    if (filter.visible === false) {
      hiddenKeys.push(`${filter.target}-${filter.type}`);
    }
    const mapping = FILTER_MAPPINGS.find((m) => m.type === filter.type && m.target === filter.target);
    if (!mapping) continue;

    let cls: string;
    if (filter.type === "blur" && filter.target === "layer") {
      // Reverse lookup from px to blur class
      const px = parseInt(filter.value);
      cls = Object.entries(BLUR_TO_PX).find(([, v]) => v === px)?.[0] || `blur-[${filter.value}px]`;
    } else if (filter.type === "blur" && filter.target === "backdrop") {
      const px = parseInt(filter.value);
      cls = Object.entries(BACKDROP_BLUR_TO_PX).find(([, v]) => v === px)?.[0] || `backdrop-blur-[${filter.value}px]`;
    } else if (filter.type === "invert") {
      const prefix = filter.target === "backdrop" ? "backdrop-invert" : "invert";
      if (filter.value === "100") cls = prefix;
      else if (filter.value === "0") cls = `${prefix}-0`;
      else cls = `${prefix}-${filter.value}`;
    } else if (filter.type === "sepia") {
      const prefix = filter.target === "backdrop" ? "backdrop-sepia" : "sepia";
      if (filter.value === "100") cls = prefix;
      else if (filter.value === "0") cls = `${prefix}-0`;
      else cls = `${prefix}-${filter.value}`;
    } else {
      cls = `${mapping.prefix}${filter.value}`;
    }

    (result as Record<string, unknown>)[mapping.field] = cls;
  }

  result.hiddenFilters = hiddenKeys.length > 0 ? JSON.stringify(hiddenKeys) : undefined;
  return result;
}

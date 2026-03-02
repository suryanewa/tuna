/**
 * Converter layer: PageStyles ↔ TailwindStyles
 *
 * Allows page rendering and editing to reuse the element's Tailwind pipeline.
 * PageStyles remains the Liveblocks storage format — no migration needed.
 *
 * Two pure functions:
 * - pageStylesToTailwind(ps) — raw PageStyles → Partial<TailwindStyles>
 * - applyTailwindToPageStyles(twUpdates, current) — Tailwind updates → PageStyles delta
 */

import type { TailwindStyles } from "@/lib/playground/editor-types";
import type { PageStyles } from "@/lib/playground/store";
import type { ShadowValue, GradientStop } from "../sections-v2";
import {
  SHADOW_PRESETS,
  INSET_SHADOW_PRESETS,
  readShadow,
  writeShadow,
  buildGradientColorClass,
  parseGradientColorClass,
  parseGradientDirection,
  buildGradientDirection,
  parseShadowColorClass,
  buildShadowColorClass,
} from "./tailwind-adapters";

// ============================================================================
// Helpers
// ============================================================================

/** Parse a Tailwind color class like "bg-[#ff0000]/50" → { color, opacity } */
function parseTwColor(cls: string, prefix: string): { color: string; opacity: number } {
  const stripped = cls.replace(`${prefix}-`, "");
  const opacityMatch = stripped.match(/^(.+?)\/(\d+)$/);
  const colorPart = opacityMatch ? opacityMatch[1] : stripped;
  const opacity = opacityMatch ? parseInt(opacityMatch[2]) : 100;
  const color = colorPart.startsWith("[") && colorPart.endsWith("]")
    ? colorPart.slice(1, -1)
    : colorPart;
  return { color, opacity };
}

/** Parse a Tailwind dimensional class like "p-[16px]" or "p-4" → pixel number or null */
function parseTwDimension(cls: string, prefix: string): number | null {
  const stripped = cls.replace(`${prefix}-`, "");
  // Arbitrary: [16px]
  const arbMatch = stripped.match(/^\[(\d+(?:\.\d+)?)px\]$/);
  if (arbMatch) return parseFloat(arbMatch[1]);
  // Named spacing: "4" → 16px
  const SPACING_TO_PX: Record<string, number> = {
    "0": 0, "0.5": 2, "1": 4, "1.5": 6, "2": 8, "2.5": 10,
    "3": 12, "3.5": 14, "4": 16, "5": 20, "6": 24, "7": 28,
    "8": 32, "9": 36, "10": 40, "11": 44, "12": 48, "14": 56,
    "16": 64, "20": 80, "24": 96,
  };
  if (stripped in SPACING_TO_PX) return SPACING_TO_PX[stripped];
  // Numeric (e.g., "16")
  const num = parseFloat(stripped);
  return isNaN(num) ? null : num;
}

/** Border radius pixel → Tailwind class */
const PX_TO_BORDER_RADIUS: Record<number, string> = {
  0: "rounded-none", 2: "rounded-sm", 4: "rounded", 6: "rounded-md",
  8: "rounded-lg", 12: "rounded-xl", 16: "rounded-2xl", 24: "rounded-3xl",
  9999: "rounded-full",
};

/** Parse border radius class → pixels */
const BORDER_RADIUS_TO_PX: Record<string, number> = {
  "rounded-none": 0, "rounded-sm": 2, "rounded": 4, "rounded-md": 6,
  "rounded-lg": 8, "rounded-xl": 12, "rounded-2xl": 16, "rounded-3xl": 24,
  "rounded-full": 9999,
};

// ============================================================================
// Forward: PageStyles → TailwindStyles
// ============================================================================

export function pageStylesToTailwind(ps: PageStyles): Partial<TailwindStyles> {
  const tw: Partial<TailwindStyles> = {};

  // ── Background color + opacity ──
  if (ps.backgroundColor) {
    const opacitySuffix = ps.backgroundOpacity != null && ps.backgroundOpacity < 100
      ? `/${Math.round(ps.backgroundOpacity)}`
      : "";
    tw.backgroundColor = `bg-[${ps.backgroundColor}]${opacitySuffix}`;
  }

  // ── Multi-fill (pass through JSON) ──
  if (ps.backgroundFills) {
    tw.backgroundFills = ps.backgroundFills;
  }

  // ── Text color ──
  if (ps.textColor) {
    tw.textColor = `text-[${ps.textColor}]`;
  }

  // ── fontFamily NOT included — handled separately as inline style ──

  // ── Line height ──
  if (ps.lineHeight != null) {
    tw.lineHeight = `leading-[${ps.lineHeight}px]`;
  }

  // ── Text align ──
  if (ps.textAlign) {
    tw.textAlign = `text-${ps.textAlign}` as TailwindStyles["textAlign"];
  }

  // ── Padding (contentPadding / per-axis / per-side) ──
  if (ps.contentPaddingTop != null || ps.contentPaddingRight != null || ps.contentPaddingBottom != null || ps.contentPaddingLeft != null) {
    // Individual per-side padding takes precedence
    tw.paddingTop = `pt-[${ps.contentPaddingTop ?? 0}px]`;
    tw.paddingRight = `pr-[${ps.contentPaddingRight ?? 0}px]`;
    tw.paddingBottom = `pb-[${ps.contentPaddingBottom ?? 0}px]`;
    tw.paddingLeft = `pl-[${ps.contentPaddingLeft ?? 0}px]`;
  } else if (ps.contentPaddingX != null || ps.contentPaddingY != null) {
    // Per-axis padding
    tw.paddingX = `px-[${ps.contentPaddingX ?? 0}px]`;
    tw.paddingY = `py-[${ps.contentPaddingY ?? 0}px]`;
  } else if (ps.contentPadding != null) {
    tw.padding = `p-[${ps.contentPadding}px]`;
  } else {
    // All padding fields are null — emit explicit zero padding so the canvas
    // never needs a hardcoded fallback (fixes phantom 24px padding bug).
    tw.padding = "p-0";
  }

  // ── Gap (elementGap) ──
  if (ps.elementGap != null) {
    tw.gap = `gap-[${ps.elementGap}px]`;
  }

  // ── Layout mode → display, flexDirection, alignItems, flexWrap ──
  switch (ps.layoutMode) {
    case "grid":
      tw.display = "grid";
      tw.flexWrap = "flex-wrap"; // benign signal for readDirection() detection
      tw.customClasses = "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
      break;
    case "centered":
      tw.display = "flex";
      tw.flexDirection = "flex-col";
      tw.alignItems = "items-center";
      break;
    case "end":
      tw.display = "flex";
      tw.flexDirection = "flex-col";
      tw.alignItems = "items-end";
      break;
    case "horizontal":
      tw.display = "flex";
      tw.flexDirection = "flex-row";
      break;
    case "stack":
    default:
      tw.display = "flex";
      tw.flexDirection = "flex-col";
      break;
  }

  // If there's a stored alignItems, use it (overrides the layoutMode default)
  if (ps.alignItems) {
    tw.alignItems = `items-${ps.alignItems}`;
  }

  // ── Justify content (main-axis alignment) ──
  if (ps.justifyContent) {
    tw.justifyContent = `justify-${ps.justifyContent}`;
  }

  // ── Max width ──
  if (ps.maxWidth != null) {
    tw.maxWidth = `max-w-[${ps.maxWidth}px]`;
    tw.marginX = "mx-[auto]";
  }

  // ── Border radius ──
  if (ps.borderRadius != null && ps.borderRadius > 0) {
    tw.borderRadius = PX_TO_BORDER_RADIUS[ps.borderRadius] ?? `rounded-[${ps.borderRadius}px]`;
  }

  // ── Border ──
  if (ps.borderWidth != null && ps.borderWidth > 0) {
    const validBorderWidths = new Set([0, 1, 2, 4, 8]);
    tw.borderWidth = validBorderWidths.has(ps.borderWidth)
      ? (ps.borderWidth === 1 ? "border" : `border-${ps.borderWidth}`)
      : `border-[${ps.borderWidth}px]`;
    const borderColor = ps.borderColor ?? "#000000";
    const borderOpacity = ps.borderOpacity ?? 100;
    const opacitySuffix = borderOpacity < 100 ? `/${borderOpacity}` : "";
    tw.borderColor = `border-[${borderColor}]${opacitySuffix}`;
    tw.borderStyle = ps.borderStyle === "dashed" ? "border-dashed" : "border-solid";
  }

  // ── Shadow ──
  let shadowValue: ShadowValue | null = null;
  if (ps.shadowData) {
    try {
      const parsed = JSON.parse(ps.shadowData);
      if (parsed && typeof parsed === "object" && "elevation" in parsed) {
        shadowValue = parsed as ShadowValue;
      }
    } catch { /* fall through to legacy */ }
  }
  if (!shadowValue && ps.shadowIntensity && ps.shadowIntensity > 0) {
    // Legacy: map intensity to approximate shadow values
    const intensity = ps.shadowIntensity;
    shadowValue = {
      type: "outside",
      angle: 90,
      distance: Math.round(intensity * 0.5),
      brightness: Math.round(intensity * 0.15),
      elevation: intensity,
      color: ps.shadowColor ?? "#000000",
      opacity: Math.round(intensity * 0.25),
    };
  }
  if (shadowValue) {
    const shadowTw = writeShadow(shadowValue);
    Object.assign(tw, shadowTw);
  }

  // ── Gradient ──
  if (ps.gradientEnabled) {
    let stops: GradientStop[] | null = null;

    // Prefer full-fidelity gradientStops JSON
    if (ps.gradientStops) {
      try {
        const parsed = JSON.parse(ps.gradientStops);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          stops = parsed;
        }
      } catch { /* fall through */ }
    }

    // Fallback to legacy gradientStart/gradientEnd
    if (!stops && ps.gradientStart && ps.gradientEnd) {
      stops = [
        { color: ps.gradientStart, position: 0 },
        { color: ps.gradientEnd, position: 1 },
      ];
    }

    if (stops && stops.length >= 2) {
      const gradType = ps.gradientType ?? "linear";
      const gradAngle = ps.gradientAngle ?? 180;
      tw.backgroundGradient = buildGradientDirection(gradType, gradAngle);
      tw.gradientFrom = buildGradientColorClass("from", stops[0].color, stops[0].opacity);
      tw.gradientTo = buildGradientColorClass("to", stops[stops.length - 1].color, stops[stops.length - 1].opacity);
      if (stops.length >= 3) {
        tw.gradientVia = buildGradientColorClass("via", stops[1].color, stops[1].opacity);
      }
      // Store full stops for round-trip fidelity
      tw.gradientStops = JSON.stringify(stops);
    }
  }

  return tw;
}

// ============================================================================
// Reverse: TailwindStyles updates → PageStyles delta
// ============================================================================

export function applyTailwindToPageStyles(
  twUpdates: Partial<TailwindStyles>,
  current: PageStyles,
): Partial<PageStyles> {
  const result: Partial<PageStyles> = {};

  // ── Background color ──
  if ("backgroundColor" in twUpdates) {
    if (twUpdates.backgroundColor) {
      const { color, opacity } = parseTwColor(twUpdates.backgroundColor, "bg");
      result.backgroundColor = color;
      result.backgroundOpacity = opacity < 100 ? opacity : null;
    } else {
      result.backgroundColor = null;
      result.backgroundOpacity = null;
    }
  }

  // ── Multi-fill ──
  if ("backgroundFills" in twUpdates) {
    result.backgroundFills = twUpdates.backgroundFills ?? null;
  }

  // ── Text color ──
  if ("textColor" in twUpdates) {
    if (twUpdates.textColor) {
      const { color } = parseTwColor(twUpdates.textColor, "text");
      result.textColor = color;
    } else {
      result.textColor = null;
    }
  }

  // ── Font family (pass through) ──
  if ("fontFamily" in twUpdates) {
    result.fontFamily = twUpdates.fontFamily || null;
  }

  // ── Line height ──
  if ("lineHeight" in twUpdates) {
    if (twUpdates.lineHeight) {
      const match = twUpdates.lineHeight.match(/leading-\[(\d+)px\]/);
      result.lineHeight = match ? parseInt(match[1]) : null;
    } else {
      result.lineHeight = null;
    }
  }

  // ── Text align ──
  if ("textAlign" in twUpdates) {
    if (twUpdates.textAlign) {
      result.textAlign = twUpdates.textAlign.replace("text-", "");
    } else {
      result.textAlign = null;
    }
  }

  // ── Padding → contentPadding / per-axis / per-side ──
  if ("paddingTop" in twUpdates || "paddingRight" in twUpdates || "paddingBottom" in twUpdates || "paddingLeft" in twUpdates) {
    // Individual per-side padding — clear uniform and axis values
    if ("paddingTop" in twUpdates) result.contentPaddingTop = twUpdates.paddingTop ? parseTwDimension(twUpdates.paddingTop, "pt") : null;
    if ("paddingRight" in twUpdates) result.contentPaddingRight = twUpdates.paddingRight ? parseTwDimension(twUpdates.paddingRight, "pr") : null;
    if ("paddingBottom" in twUpdates) result.contentPaddingBottom = twUpdates.paddingBottom ? parseTwDimension(twUpdates.paddingBottom, "pb") : null;
    if ("paddingLeft" in twUpdates) result.contentPaddingLeft = twUpdates.paddingLeft ? parseTwDimension(twUpdates.paddingLeft, "pl") : null;
    result.contentPadding = null;
    result.contentPaddingX = null;
    result.contentPaddingY = null;
  } else if ("padding" in twUpdates || "paddingX" in twUpdates || "paddingY" in twUpdates) {
    // XY or uniform padding — clear per-side values
    const cls = twUpdates.padding ?? twUpdates.paddingX ?? twUpdates.paddingY;
    if (cls) {
      const prefix = twUpdates.padding ? "p" : twUpdates.paddingX ? "px" : "py";
      if (twUpdates.padding) {
        result.contentPadding = parseTwDimension(cls, prefix);
        result.contentPaddingX = null;
        result.contentPaddingY = null;
      } else {
        if ("paddingX" in twUpdates) result.contentPaddingX = twUpdates.paddingX ? parseTwDimension(twUpdates.paddingX, "px") : null;
        if ("paddingY" in twUpdates) result.contentPaddingY = twUpdates.paddingY ? parseTwDimension(twUpdates.paddingY, "py") : null;
        result.contentPadding = null;
      }
    } else {
      result.contentPadding = null;
      result.contentPaddingX = null;
      result.contentPaddingY = null;
    }
    result.contentPaddingTop = null;
    result.contentPaddingRight = null;
    result.contentPaddingBottom = null;
    result.contentPaddingLeft = null;
  }

  // ── Gap → elementGap ──
  if ("gap" in twUpdates) {
    if (twUpdates.gap) {
      result.elementGap = parseTwDimension(twUpdates.gap, "gap");
    } else {
      result.elementGap = null;
    }
  }

  // ── Layout mode (direction + alignment + display) ──
  const layoutKeys = ["flexDirection", "alignItems", "flexWrap", "display"] as const;
  if (layoutKeys.some((k) => k in twUpdates)) {
    // Merge update with current state to get full picture
    const currentTw = pageStylesToTailwind(current);
    const merged = { ...currentTw, ...twUpdates };

    // If flexWrap is explicitly being cleared (writeDirection("vertical") sets flexWrap: undefined),
    // the user is intentionally leaving grid/wrap mode — don't let display: "grid" from
    // current state keep it in grid mode.
    const flexWrapCleared = "flexWrap" in twUpdates && !twUpdates.flexWrap;
    const isGrid = flexWrapCleared
      ? merged.flexWrap === "flex-wrap" // only explicit flex-wrap triggers grid
      : merged.flexWrap === "flex-wrap" || merged.display === "grid";

    if (isGrid) {
      result.layoutMode = "grid";
    } else if (merged.flexDirection === "flex-row") {
      result.layoutMode = "horizontal";
    } else if (merged.alignItems === "items-center") {
      result.layoutMode = "centered";
    } else if (merged.alignItems === "items-end") {
      result.layoutMode = "end";
    } else {
      result.layoutMode = "stack";
    }
  }

  // ── Justify content (main-axis alignment) ──
  if ("justifyContent" in twUpdates) {
    if (twUpdates.justifyContent) {
      const val = twUpdates.justifyContent.replace("justify-", "");
      result.justifyContent = val;
    } else {
      result.justifyContent = null;
    }
  }

  // ── Align items (cross-axis alignment) ──
  if ("alignItems" in twUpdates) {
    if (twUpdates.alignItems) {
      const val = twUpdates.alignItems.replace("items-", "");
      result.alignItems = val;
    } else {
      result.alignItems = null;
    }
  }

  // ── Max width ──
  if ("maxWidth" in twUpdates) {
    if (twUpdates.maxWidth) {
      const match = twUpdates.maxWidth.match(/max-w-\[(\d+)px\]/);
      result.maxWidth = match ? parseInt(match[1]) : null;
    } else {
      result.maxWidth = null;
    }
  }

  // ── Border radius ──
  if ("borderRadius" in twUpdates) {
    if (twUpdates.borderRadius) {
      const px = BORDER_RADIUS_TO_PX[twUpdates.borderRadius];
      if (px !== undefined) {
        result.borderRadius = px;
      } else {
        const match = twUpdates.borderRadius.match(/rounded-\[(\d+)px\]/);
        result.borderRadius = match ? parseInt(match[1]) : null;
      }
    } else {
      result.borderRadius = null;
    }
  }

  // ── Border ──
  const borderKeys = ["borderWidth", "borderColor", "borderStyle"] as const;
  if (borderKeys.some((k) => k in twUpdates)) {
    if ("borderWidth" in twUpdates) {
      if (twUpdates.borderWidth) {
        const BORDER_WIDTH_TO_PX: Record<string, number> = {
          "border-0": 0, "border": 1, "border-2": 2, "border-4": 4, "border-8": 8,
        };
        let w: number | null = BORDER_WIDTH_TO_PX[twUpdates.borderWidth] ?? null;
        if (w === null) {
          const arbMatch = twUpdates.borderWidth.match(/\[(\d+(?:\.\d+)?)px\]/);
          w = arbMatch ? parseFloat(arbMatch[1]) : null;
        }
        result.borderWidth = w;
      } else {
        result.borderWidth = null;
        result.borderColor = null;
        result.borderOpacity = null;
        result.borderStyle = null;
      }
    }
    if ("borderColor" in twUpdates) {
      if (twUpdates.borderColor) {
        const { color, opacity } = parseTwColor(twUpdates.borderColor, "border");
        result.borderColor = color;
        result.borderOpacity = opacity < 100 ? opacity : null;
      } else {
        result.borderColor = null;
        result.borderOpacity = null;
      }
    }
    if ("borderStyle" in twUpdates) {
      result.borderStyle = twUpdates.borderStyle === "border-dashed" ? "dashed" : "solid";
    }
  }

  // ── Shadow (merge ALL keys before reading) ──
  const shadowKeys = ["shadow", "shadowColor", "insetShadow", "insetShadowColor"] as const;
  if (shadowKeys.some((k) => k in twUpdates)) {
    const currentTw = pageStylesToTailwind(current);
    const tempTw = {
      shadow: "shadow" in twUpdates ? twUpdates.shadow : currentTw.shadow,
      shadowColor: "shadowColor" in twUpdates ? twUpdates.shadowColor : currentTw.shadowColor,
      insetShadow: "insetShadow" in twUpdates ? twUpdates.insetShadow : currentTw.insetShadow,
      insetShadowColor: "insetShadowColor" in twUpdates ? twUpdates.insetShadowColor : currentTw.insetShadowColor,
    } as TailwindStyles;
    const sv = readShadow(tempTw);
    result.shadowData = sv ? JSON.stringify(sv) : null;
    result.shadowIntensity = sv?.elevation ?? null;
    result.shadowColor = sv?.color ?? null;
  }

  // ── Gradient ──
  const gradientKeys = [
    "backgroundGradient", "gradientFrom", "gradientVia", "gradientTo", "gradientStops",
  ] as const;
  if (gradientKeys.some((k) => k in twUpdates)) {
    // Merge with current TW to get full gradient state
    const currentTw = pageStylesToTailwind(current);
    const merged = { ...currentTw, ...twUpdates };

    if (merged.backgroundGradient && merged.gradientFrom && merged.gradientTo) {
      const { type, angle } = parseGradientDirection(merged.backgroundGradient);
      result.gradientEnabled = true;
      result.gradientType = type;
      result.gradientAngle = angle;

      // Parse from/to colors for legacy fields
      const fromParsed = parseGradientColorClass(merged.gradientFrom, "from");
      const toParsed = parseGradientColorClass(merged.gradientTo, "to");
      result.gradientStart = fromParsed?.color ?? null;
      result.gradientEnd = toParsed?.color ?? null;

      // Full-fidelity stops
      result.gradientStops = merged.gradientStops ?? null;
    } else {
      result.gradientEnabled = false;
      result.gradientStart = null;
      result.gradientEnd = null;
      result.gradientType = null;
      result.gradientStops = null;
    }
  }

  return result;
}

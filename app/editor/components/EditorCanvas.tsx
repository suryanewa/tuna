"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { useYjsEditor, elementClipboard } from "./YjsEditorContext";
import { useCamera } from "./CameraContext";
import { type Camera, screenToWorld, zoomAtPoint, cameraToFitRect } from "./camera-utils";
import { getStyleClasses, parseReactEffect, type TailwindStyles } from "@/lib/playground/editor-types";
import DOMPurify from "dompurify";
import type { JsonObject } from "@liveblocks/client";
import { useStorage } from "@liveblocks/react";
import {
  useElement, useEditorMutations, editorStateStore,
  useIsSelected, useEditingElementId, useDraggedId,
  useDevice, usePreviewFont, useIsAdmin,
} from "./context";
import { cn } from "@/lib/utils";
import { type CanvasElement, type Page, ARTBOARD_LAYER_ID, defaultPageStyles } from "@/lib/playground/store";
import { isInternalLink, parseInternalLink } from "@/lib/playground/link-utils";
import { pageStylesToTailwind } from "./adapters/page-tailwind-converter";
import { SelectionOverlay, creationFlag, spatialDragFlag, DUPLICATE_CURSOR } from "./overlay/SelectionOverlay";
import { useContextMenu, ContextMenu, type ContextMenuItemDef } from "./ui/context-menu";
import { MarqueeOverlay, marqueeFlag } from "./overlay/MarqueeOverlay";
import { CursorLayer } from "../multiplayer/CursorLayer";
import { usePlayground } from "../PlaygroundProvider";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import dynamic from "next/dynamic";
import { ArtboardWidthProvider } from "@/hooks/useArtboardWidth";
import { TiptapTextEditor } from "./tiptap/TiptapTextEditor";
import { generateHTML } from "@tiptap/html";
import { createEditorExtensions } from "./tiptap/tiptap-extensions";

const PodcastPageContent = dynamic(
  () => import("@/app/components/PodcastPageContent"),
  { ssr: false, loading: () => <div className="animate-pulse bg-muted h-full" /> }
);

import { PodcastProvider } from "./podcast/PodcastProvider";
import { PodcastComponentRenderer } from "./podcast/PodcastComponentRenderer";
import { loadGoogleFont } from "./font-picker/font-loader";
import { AnimationStyles } from "./animation-styles";
import { EffectLayer } from "./effect-layer";
import { EffectLayerRenderer } from "./effects/effect-layer-renderer";
import { ShaderRenderer } from "./effects/shader-renderer";
import { ElementShaderLayers, ShaderTextFill } from "./effects/element-shader-layers";
import { InlineEffectWrapper } from "./inline-effect-wrapper";
import { useAnimationTriggers } from "./use-animation-triggers";
import { generateBeautifulShadow } from "./sections-v2/shadow-utils";
import type { ShadowValue } from "./sections-v2/shadow-section";
import { SHADOW_PRESETS, INSET_SHADOW_PRESETS, parseShadowColorClass } from "./adapters/tailwind-adapters";

// Precompute Tiptap extensions once at module level (pure function, no element-specific args)
const EDITOR_EXTENSIONS = createEditorExtensions();

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

// Flag: canvas wrapper's pointerdown already handled selection, so inner handleClick should skip.
// Module-level (like marqueeFlag) so both EditorCanvas and RenderElement can share it.
const canvasDragFlag = { didDrag: false };


export const elementContextMenuRef = {
  open: null as ((x: number, y: number, elementId: string) => void) | null,
  openText: null as ((x: number, y: number, elementId: string) => void) | null,
};



type CanvasContextMeta =
  | { type: "canvas" }
  | { type: "element"; elementId: string }
  | { type: "text"; elementId: string };

// Custom black arrow cursor with drop shadow
const CURSOR_SVG = `<svg width="20" height="20" viewBox="0 0.5 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><filter id="s" x="0" y="0.5" width="20" height="20" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="a"/><feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="b"/><feOffset dy="1"/><feGaussianBlur stdDeviation="1.5"/><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.35 0"/><feBlend mode="normal" in2="a" result="c"/><feBlend mode="normal" in="SourceGraphic" in2="c" result="shape"/></filter></defs><g filter="url(#s)"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.43938 2.93938C3.85531 2.52345 4.47597 2.38901 5.02673 2.59555L16.0267 6.72055C16.6416 6.95111 17.035 7.55477 16.9976 8.21034C16.9603 8.86592 16.5009 9.421 15.8638 9.58026L11.237 10.737L10.0803 15.3638C9.921 16.0009 9.36592 16.4603 8.71034 16.4976C8.05477 16.535 7.45111 16.1416 7.22055 15.5267L3.09555 4.52673C2.88901 3.97597 3.02345 3.35531 3.43938 2.93938Z" fill="white"/></g><path fill-rule="evenodd" clip-rule="evenodd" d="M4.67558 3.53185C4.49199 3.463 4.2851 3.50782 4.14646 3.64646C4.00782 3.7851 3.963 3.99199 4.03185 4.17558L8.15685 15.1756C8.2337 15.3805 8.43492 15.5117 8.65345 15.4992C8.87197 15.4868 9.057 15.3336 9.11009 15.1213L10.4123 9.91232L15.6213 8.61009C15.8336 8.557 15.9868 8.37197 15.9992 8.15345C16.0117 7.93492 15.8805 7.7337 15.6756 7.65685L4.67558 3.53185Z" fill="black"/></svg>`;
const CUSTOM_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(CURSOR_SVG)}") 4 3, default`;


// Derive device from viewport width for preview mode responsive behavior
function useViewportDevice(enabled: boolean): "desktop" | "tablet" | "mobile" {
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const w = window.innerWidth;
      setDevice(w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop");
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [enabled]);
  return enabled ? device : "desktop";
}

// Get effective styles for an element based on device
function getElementEffectiveStyles(
  element: CanvasElement,
  device: "desktop" | "tablet" | "mobile"
): TailwindStyles {
  // Spread to get plain objects from SyncedStore proxies
  const base = element.tailwindStyles ? { ...element.tailwindStyles } : {};
  const responsive = element.responsiveStyles ? { ...element.responsiveStyles } : null;

  if (!responsive) return base;

  // Spread nested responsive objects too
  const responsiveBase = responsive.base ? { ...responsive.base } : {};
  const responsiveTablet = responsive.tablet ? { ...responsive.tablet } : {};
  const responsiveMobile = responsive.mobile ? { ...responsive.mobile } : {};

  // Cascade: base -> tablet -> mobile
  if (device === "desktop") {
    return { ...base, ...responsiveBase };
  }

  if (device === "tablet") {
    return { ...base, ...responsiveBase, ...responsiveTablet };
  }

  // Mobile gets all overrides
  return { ...base, ...responsiveBase, ...responsiveTablet, ...responsiveMobile };
}

function getElementStyleClasses(
  element: CanvasElement,
  device: "desktop" | "tablet" | "mobile" = "desktop"
): string {
  const styles = getElementEffectiveStyles(element, device);
  return getStyleClasses(styles);
}

// Tailwind arbitrary-value prefix → CSS property (or array for shorthand axes)
// Used to convert e.g. w-[300px] → style={{ width: '300px' }}
const ARB_COLOR_TO_CSS: Record<string, keyof React.CSSProperties> = {
  'bg': 'backgroundColor',
  'text': 'color',
  'border': 'borderColor',
};

const ARB_DIM_TO_CSS: Record<string, keyof React.CSSProperties | (keyof React.CSSProperties)[]> = {
  'w': 'width',
  'h': 'height',
  'min-w': 'minWidth',
  'min-h': 'minHeight',
  'max-w': 'maxWidth',
  'max-h': 'maxHeight',
  'gap': 'gap',
  'gap-x': 'columnGap',
  'gap-y': 'rowGap',
  'p': ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
  'px': ['paddingLeft', 'paddingRight'],
  'py': ['paddingTop', 'paddingBottom'],
  'pt': 'paddingTop',
  'pr': 'paddingRight',
  'pb': 'paddingBottom',
  'pl': 'paddingLeft',
  'm': ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
  'mx': ['marginLeft', 'marginRight'],
  'my': ['marginTop', 'marginBottom'],
  'mt': 'marginTop',
  'mr': 'marginRight',
  'mb': 'marginBottom',
  'ml': 'marginLeft',
  'top': 'top',
  'right': 'right',
  'bottom': 'bottom',
  'left': 'left',
  'inset': 'inset',
  'opacity': 'opacity',
  'text': 'fontSize',
  'leading': 'lineHeight',
  'tracking': 'letterSpacing',
  'rounded': 'borderRadius',
  'rounded-tl': 'borderTopLeftRadius',
  'rounded-tr': 'borderTopRightRadius',
  'rounded-bl': 'borderBottomLeftRadius',
  'rounded-br': 'borderBottomRightRadius',
  'border': 'borderWidth',
  'border-t': 'borderTopWidth',
  'border-r': 'borderRightWidth',
  'border-b': 'borderBottomWidth',
  'border-l': 'borderLeftWidth',
  'z': 'zIndex',
};

// Shadow preset → inline CSS (Tailwind v4 class names)
// Tailwind JIT may not generate CSS for dynamically-applied shadow preset classes.
const SHADOW_PRESET_CSS_MAP: Record<string, string> = {
  "shadow-none": "0 0 #0000",
  "shadow-2xs": "0 1px rgb(0 0 0 / 0.05)",
  "shadow-xs": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  "shadow-sm": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  "shadow": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  "shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  "shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  "shadow-xl": "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  "shadow-2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
};

const INSET_SHADOW_PRESET_CSS_MAP: Record<string, string> = {
  "inset-shadow-none": "inset 0 0 #0000",
  "inset-shadow-2xs": "inset 0 1px rgb(0 0 0 / 0.05)",
  "inset-shadow-xs": "inset 0 1px 1px rgb(0 0 0 / 0.05)",
  "inset-shadow-sm": "inset 0 2px 4px rgb(0 0 0 / 0.05)",
  "inset-shadow": "inset 0 2px 4px rgb(0 0 0 / 0.05)",
  "inset-shadow-md": "inset 0 4px 6px rgb(0 0 0 / 0.1)",
  "inset-shadow-lg": "inset 0 6px 10px rgb(0 0 0 / 0.1)",
};

// Extract arbitrary Tailwind values (colors, sizes, spacing, etc.) and convert to inline styles.
// Tailwind JIT doesn't generate CSS for dynamically created arbitrary values like w-[300px].
const _extractCache = new Map<string, { filteredClasses: string; inlineStyles: React.CSSProperties }>();
const EXTRACT_CACHE_MAX = 200;

function extractArbitraryStyles(classes: string, gradientStopsJson?: string, hiddenFiltersJson?: string, textGradientJson?: string, backgroundFillsJson?: string): {
  filteredClasses: string;
  inlineStyles: React.CSSProperties;
} {
  const cacheKey = `${classes}\0${gradientStopsJson ?? ""}\0${hiddenFiltersJson ?? ""}\0${textGradientJson ?? ""}\0${backgroundFillsJson ?? ""}`;
  const cached = _extractCache.get(cacheKey);
  if (cached) return { filteredClasses: cached.filteredClasses, inlineStyles: { ...cached.inlineStyles } };

  const inlineStyles: React.CSSProperties = {};
  const filtered: string[] = [];
  const filterFns: string[] = [];
  const backdropFilterFns: string[] = [];
  const translateParts: [string, string] = ['0', '0'];
  let hasTranslate = false;

  // Parse hidden filter keys so we skip them visually
  let hiddenFilterKeys: string[] = [];
  if (hiddenFiltersJson) {
    try { hiddenFilterKeys = JSON.parse(hiddenFiltersJson); } catch { /* ignore */ }
  }

  // ── Gradient accumulator: collect direction + from/via/to across classes ──
  let gradientDirection: string | null = null; // e.g. "to bottom", "135deg"
  let gradientFrom: string | null = null;
  let gradientVia: string | null = null;
  let gradientTo: string | null = null;

  for (const cls of classes.split(" ")) {
    // ── Gradient direction classes ──
    const linearDirMap: Record<string, string> = {
      "bg-linear-to-t": "to top",
      "bg-linear-to-tr": "to top right",
      "bg-linear-to-r": "to right",
      "bg-linear-to-br": "to bottom right",
      "bg-linear-to-b": "to bottom",
      "bg-linear-to-bl": "to bottom left",
      "bg-linear-to-l": "to left",
      "bg-linear-to-tl": "to top left",
    };
    if (cls in linearDirMap) {
      gradientDirection = linearDirMap[cls];
      continue;
    }
    if (cls === "bg-radial") {
      gradientDirection = "radial";
      continue;
    }
    if (cls === "bg-conic") {
      gradientDirection = "conic";
      continue;
    }
    // bg-conic-[from_Ndeg] → conic gradient with angle
    const conicAngleMatch = cls.match(/^bg-conic-\[from[_ ](\d+)deg\]$/);
    if (conicAngleMatch) {
      gradientDirection = `conic from ${conicAngleMatch[1]}deg`;
      continue;
    }
    // bg-linear-[Ndeg]
    const linearArbMatch = cls.match(/^bg-linear-\[(\d+)deg\]$/);
    if (linearArbMatch) {
      gradientDirection = `${linearArbMatch[1]}deg`;
      continue;
    }

    // ── Gradient color classes: from-*, via-*, to-* (with optional /opacity) ──
    const gradColorMatch = cls.match(/^(from|via|to)-(.+?)(?:\/(\d+))?$/);
    if (gradColorMatch) {
      const [, role, colorPart, opacityStr] = gradColorMatch;
      let color = tailwindToColor(colorPart);
      if (opacityStr && color.startsWith("#")) {
        const alpha = parseInt(opacityStr, 10) / 100;
        const h = color.replace("#", "");
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        color = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
      if (role === "from") gradientFrom = color;
      else if (role === "via") gradientVia = color;
      else if (role === "to") gradientTo = color;
      continue;
    }

    // Match prefix-[value] with optional /opacity
    const match = cls.match(/^(.+?)-\[(.+)\](?:\/(\d+))?$/);
    if (!match) {
      filtered.push(cls);
      continue;
    }

    const [, prefix, value, opacityStr] = match;

    // ── Color arbitrary values: bg-[#hex], text-[#hex], border-[#hex] ──
    if (value.startsWith('#')) {
      const colorProp = ARB_COLOR_TO_CSS[prefix];
      if (colorProp) {
        let hex = value.slice(1); // remove #
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        const opacity = opacityStr ? parseInt(opacityStr) / 100 : 1;
        if (opacity < 1) {
          const r = parseInt(hex.slice(0, 2), 16);
          const g = parseInt(hex.slice(2, 4), 16);
          const b = parseInt(hex.slice(4, 6), 16);
          (inlineStyles as any)[colorProp] = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        } else {
          (inlineStyles as any)[colorProp] = `#${hex}`;
        }
        continue;
      }
      // Shadow color arbitrary values: shadow-[#hex], inset-shadow-[#hex]
      if (prefix === 'shadow' || prefix === 'inset-shadow') {
        let hex = value.slice(1); // remove #
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        const opacity = opacityStr ? parseInt(opacityStr) / 100 : 1;
        const colorVal = opacity < 1
          ? `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}, ${opacity})`
          : `#${hex}`;
        (inlineStyles as any)['--tw-shadow-color'] = colorVal;
        continue;
      }
      // Gradient colors (from, via, to) — keep as classes
      filtered.push(cls);
      continue;
    }

    // ── Filter arbitrary values: blur-[6px] → filter: blur(6px) ──
    if (prefix === 'blur') {
      if (!hiddenFilterKeys.includes('layer-blur')) filterFns.push(`blur(${value})`);
      continue;
    }
    if (prefix === 'backdrop-blur') {
      if (!hiddenFilterKeys.includes('backdrop-blur')) backdropFilterFns.push(`blur(${value})`);
      continue;
    }

    // ── Transform arbitrary values: rotate-[37deg] → rotate: 37deg, -rotate-[37deg] → rotate: -37deg ──
    if (prefix === 'rotate') {
      inlineStyles.rotate = value;
      continue;
    }
    if (prefix === '-rotate') {
      inlineStyles.rotate = `-${value}`;
      continue;
    }

    // ── Dimensional arbitrary values: w-[300px], gap-[16px], rounded-[8px], etc. ──
    const dimProp = ARB_DIM_TO_CSS[prefix];
    if (dimProp) {
      if (Array.isArray(dimProp)) {
        for (const prop of dimProp) {
          (inlineStyles as any)[prop] = value;
        }
      } else {
        (inlineStyles as any)[dimProp] = value;
      }
      continue;
    }

    // Unmatched arbitrary value — keep as class
    filtered.push(cls);
  }

  // ── Utilities that Tailwind v4 fails to generate via @source inline() ──
  // Convert to inline styles so the canvas renders them correctly.
  const utilityMap: Record<string, () => void> = {
    'list-disc': () => { inlineStyles.listStyleType = 'disc'; inlineStyles.listStylePosition = 'inside'; },
    'list-decimal': () => { inlineStyles.listStyleType = 'decimal'; inlineStyles.listStylePosition = 'inside'; },
    'list-none': () => { inlineStyles.listStyleType = 'none'; },
    'list-item': () => { inlineStyles.display = 'list-item'; },
    'list-inside': () => { inlineStyles.listStylePosition = 'inside'; },
    // Object fit
    'object-cover': () => { inlineStyles.objectFit = 'cover'; },
    'object-contain': () => { inlineStyles.objectFit = 'contain'; },
    'object-fill': () => { inlineStyles.objectFit = 'fill'; },
    'object-none': () => { inlineStyles.objectFit = 'none'; },
    'object-scale-down': () => { inlineStyles.objectFit = 'scale-down'; },
    // Object position
    'object-center': () => { inlineStyles.objectPosition = 'center'; },
    'object-top': () => { inlineStyles.objectPosition = 'top'; },
    'object-bottom': () => { inlineStyles.objectPosition = 'bottom'; },
    'object-left': () => { inlineStyles.objectPosition = 'left'; },
    'object-right': () => { inlineStyles.objectPosition = 'right'; },
    'object-left-top': () => { inlineStyles.objectPosition = 'left top'; },
    'object-left-bottom': () => { inlineStyles.objectPosition = 'left bottom'; },
    'object-right-top': () => { inlineStyles.objectPosition = 'right top'; },
    'object-right-bottom': () => { inlineStyles.objectPosition = 'right bottom'; },
    // Margin auto for centering
    'ml-auto': () => { inlineStyles.marginLeft = 'auto'; },
    'mr-auto': () => { inlineStyles.marginRight = 'auto'; },
    'mt-auto': () => { inlineStyles.marginTop = 'auto'; },
    'mb-auto': () => { inlineStyles.marginBottom = 'auto'; },
    'mx-auto': () => { inlineStyles.marginLeft = 'auto'; inlineStyles.marginRight = 'auto'; },
    'my-auto': () => { inlineStyles.marginTop = 'auto'; inlineStyles.marginBottom = 'auto'; },
    'mx-[auto]': () => { inlineStyles.marginLeft = 'auto'; inlineStyles.marginRight = 'auto'; },
    // Translate for absolute centering (uses CSS translate property, separate from rotate)
    '-translate-x-1/2': () => { translateParts[0] = '-50%'; hasTranslate = true; },
    '-translate-y-1/2': () => { translateParts[1] = '-50%'; hasTranslate = true; },
    'translate-x-0': () => { translateParts[0] = '0'; hasTranslate = true; },
    'translate-y-0': () => { translateParts[1] = '0'; hasTranslate = true; },
  };
  const secondPass: string[] = [];
  for (const cls of filtered) {
    // Static utility map
    const fn = utilityMap[cls];
    if (fn) {
      fn();
      secondPass.push(cls);
      continue;
    }
    // line-clamp-N: override height so the clamp controls visible lines
    const lcMatch = cls.match(/^line-clamp-(\d+)$/);
    if (lcMatch) {
      const n = parseInt(lcMatch[1], 10);
      inlineStyles.overflow = 'hidden';
      inlineStyles.display = '-webkit-box';
      (inlineStyles as any).WebkitBoxOrient = 'vertical';
      (inlineStyles as any).WebkitLineClamp = n;
      inlineStyles.height = 'auto';
      secondPass.push(cls);
      continue;
    }
    // opacity-N: Tailwind JIT won't generate CSS for dynamic opacity-85 etc.
    const opacityMatch = cls.match(/^opacity-(\d+)$/);
    if (opacityMatch) {
      inlineStyles.opacity = parseInt(opacityMatch[1], 10) / 100;
      continue;
    }
    // leading-N (numeric): Tailwind JIT won't generate CSS for dynamic leading-10 etc.
    const leadingMatch = cls.match(/^leading-(\d+)$/);
    if (leadingMatch) {
      inlineStyles.lineHeight = `${parseInt(leadingMatch[1], 10) * 4}px`;
      continue;
    }
    // Viewport size classes: h-dvh → height: 100dvh, w-dvw → width: 100dvw, etc.
    // Also handles legacy h-screen/w-screen (100vh/100vw).
    const VIEWPORT_CLASSES: Record<string, [keyof React.CSSProperties, string]> = {
      'h-dvh': ['height', '100dvh'],
      'w-dvw': ['width', '100dvw'],
      'h-screen': ['height', '100vh'],
      'w-screen': ['width', '100vw'],
      'min-h-dvh': ['minHeight', '100dvh'],
      'min-w-dvw': ['minWidth', '100dvw'],
      'min-h-screen': ['minHeight', '100vh'],
      'min-w-screen': ['minWidth', '100vw'],
      'max-h-dvh': ['maxHeight', '100dvh'],
      'max-w-dvw': ['maxWidth', '100dvw'],
    };
    if (cls in VIEWPORT_CLASSES) {
      const [prop, val] = VIEWPORT_CLASSES[cls];
      (inlineStyles as any)[prop] = val;
      continue;
    }
    // Named size classes: w-14 → width: 56px, h-8 → height: 32px
    // Tailwind JIT won't generate CSS for dynamically-applied size classes.
    // Backward compat for elements stored before the arbitrary-value fix.
    const namedSizeMatch = cls.match(/^(w|h|min-w|min-h|max-w|max-h)-(\d+\.?\d*)$/);
    if (namedSizeMatch) {
      const [, sizePrefix, unit] = namedSizeMatch;
      const px = parseFloat(unit) * 4;
      // Skip max-w-0 / max-h-0 — 0px max is never useful and was stored erroneously
      if (px === 0 && (sizePrefix === 'max-w' || sizePrefix === 'max-h')) {
        continue;
      }
      const cssProp = ARB_DIM_TO_CSS[sizePrefix];
      if (cssProp && !isNaN(px)) {
        if (Array.isArray(cssProp)) {
          for (const prop of cssProp) (inlineStyles as any)[prop] = `${px}px`;
        } else {
          (inlineStyles as any)[cssProp] = `${px}px`;
        }
        continue;
      }
    }
    // Shadow preset classes: Tailwind JIT may not generate CSS for dynamically-applied shadows
    if (cls in SHADOW_PRESET_CSS_MAP) {
      inlineStyles.boxShadow = SHADOW_PRESET_CSS_MAP[cls];
      continue;
    }
    if (cls in INSET_SHADOW_PRESET_CSS_MAP) {
      inlineStyles.boxShadow = INSET_SHADOW_PRESET_CSS_MAP[cls];
      continue;
    }
    // ── Filter/backdrop-filter classes: convert to inline CSS ──
    // Layer filters: brightness-N, contrast-N, hue-rotate-N, saturate-N, invert, invert-0, sepia, sepia-0
    const brightnessMatch = cls.match(/^brightness-(\d+)$/);
    if (brightnessMatch) { if (!hiddenFilterKeys.includes('layer-brightness')) filterFns.push(`brightness(${parseInt(brightnessMatch[1]) / 100})`); continue; }
    const contrastMatch = cls.match(/^contrast-(\d+)$/);
    if (contrastMatch) { if (!hiddenFilterKeys.includes('layer-contrast')) filterFns.push(`contrast(${parseInt(contrastMatch[1]) / 100})`); continue; }
    const hueRotateMatch = cls.match(/^hue-rotate-(\d+)$/);
    if (hueRotateMatch) { if (!hiddenFilterKeys.includes('layer-hueRotate')) filterFns.push(`hue-rotate(${hueRotateMatch[1]}deg)`); continue; }
    const saturateMatch = cls.match(/^saturate-(\d+)$/);
    if (saturateMatch) { if (!hiddenFilterKeys.includes('layer-saturate')) filterFns.push(`saturate(${parseInt(saturateMatch[1]) / 100})`); continue; }
    if (cls === 'invert') { if (!hiddenFilterKeys.includes('layer-invert')) filterFns.push('invert(1)'); continue; }
    if (cls === 'invert-0') { if (!hiddenFilterKeys.includes('layer-invert')) filterFns.push('invert(0)'); continue; }
    const invertMatch = cls.match(/^invert-(\d+)$/);
    if (invertMatch) { if (!hiddenFilterKeys.includes('layer-invert')) filterFns.push(`invert(${parseInt(invertMatch[1]) / 100})`); continue; }
    if (cls === 'sepia') { if (!hiddenFilterKeys.includes('layer-sepia')) filterFns.push('sepia(1)'); continue; }
    if (cls === 'sepia-0') { if (!hiddenFilterKeys.includes('layer-sepia')) filterFns.push('sepia(0)'); continue; }
    const sepiaMatch = cls.match(/^sepia-(\d+)$/);
    if (sepiaMatch) { if (!hiddenFilterKeys.includes('layer-sepia')) filterFns.push(`sepia(${parseInt(sepiaMatch[1]) / 100})`); continue; }
    // Named blur presets: blur-sm, blur-md, etc. (non-arbitrary)
    const namedBlurMatch = cls.match(/^blur-(none|sm|md|lg|xl|2xl|3xl)$/);
    if (namedBlurMatch) {
      const blurPx: Record<string, number> = { none: 0, sm: 4, md: 12, lg: 16, xl: 24, '2xl': 40, '3xl': 64 };
      if (!hiddenFilterKeys.includes('layer-blur')) filterFns.push(`blur(${blurPx[namedBlurMatch[1]] ?? 0}px)`); continue;
    }
    if (cls === 'blur') { if (!hiddenFilterKeys.includes('layer-blur')) filterFns.push('blur(8px)'); continue; }
    // Backdrop filters: backdrop-brightness-N, backdrop-contrast-N, etc.
    const bdBrightnessMatch = cls.match(/^backdrop-brightness-(\d+)$/);
    if (bdBrightnessMatch) { if (!hiddenFilterKeys.includes('backdrop-brightness')) backdropFilterFns.push(`brightness(${parseInt(bdBrightnessMatch[1]) / 100})`); continue; }
    const bdContrastMatch = cls.match(/^backdrop-contrast-(\d+)$/);
    if (bdContrastMatch) { if (!hiddenFilterKeys.includes('backdrop-contrast')) backdropFilterFns.push(`contrast(${parseInt(bdContrastMatch[1]) / 100})`); continue; }
    const bdHueRotateMatch = cls.match(/^backdrop-hue-rotate-(\d+)$/);
    if (bdHueRotateMatch) { if (!hiddenFilterKeys.includes('backdrop-hueRotate')) backdropFilterFns.push(`hue-rotate(${bdHueRotateMatch[1]}deg)`); continue; }
    const bdSaturateMatch = cls.match(/^backdrop-saturate-(\d+)$/);
    if (bdSaturateMatch) { if (!hiddenFilterKeys.includes('backdrop-saturate')) backdropFilterFns.push(`saturate(${parseInt(bdSaturateMatch[1]) / 100})`); continue; }
    if (cls === 'backdrop-invert') { if (!hiddenFilterKeys.includes('backdrop-invert')) backdropFilterFns.push('invert(1)'); continue; }
    if (cls === 'backdrop-invert-0') { if (!hiddenFilterKeys.includes('backdrop-invert')) backdropFilterFns.push('invert(0)'); continue; }
    const bdInvertMatch = cls.match(/^backdrop-invert-(\d+)$/);
    if (bdInvertMatch) { if (!hiddenFilterKeys.includes('backdrop-invert')) backdropFilterFns.push(`invert(${parseInt(bdInvertMatch[1]) / 100})`); continue; }
    if (cls === 'backdrop-sepia') { if (!hiddenFilterKeys.includes('backdrop-sepia')) backdropFilterFns.push('sepia(1)'); continue; }
    if (cls === 'backdrop-sepia-0') { if (!hiddenFilterKeys.includes('backdrop-sepia')) backdropFilterFns.push('sepia(0)'); continue; }
    const bdSepiaMatch = cls.match(/^backdrop-sepia-(\d+)$/);
    if (bdSepiaMatch) { if (!hiddenFilterKeys.includes('backdrop-sepia')) backdropFilterFns.push(`sepia(${parseInt(bdSepiaMatch[1]) / 100})`); continue; }
    const namedBdBlurMatch = cls.match(/^backdrop-blur-(none|sm|md|lg|xl|2xl|3xl)$/);
    if (namedBdBlurMatch) {
      const blurPx: Record<string, number> = { none: 0, sm: 4, md: 12, lg: 16, xl: 24, '2xl': 40, '3xl': 64 };
      if (!hiddenFilterKeys.includes('backdrop-blur')) backdropFilterFns.push(`blur(${blurPx[namedBdBlurMatch[1]] ?? 0}px)`); continue;
    }
    if (cls === 'backdrop-blur') { if (!hiddenFilterKeys.includes('backdrop-blur')) backdropFilterFns.push('blur(8px)'); continue; }
    secondPass.push(cls);
  }

  // ── Build gradient backgroundImage from accumulated parts ──
  if (gradientDirection) {
    let gradientBody: string | null = null;

    // Prefer full-fidelity gradientStops JSON (supports 4+ stops, positions, opacity)
    if (gradientStopsJson) {
      try {
        const parsed = JSON.parse(gradientStopsJson) as { color: string; position: number; opacity?: number }[];
        if (Array.isArray(parsed) && parsed.length >= 2) {
          gradientBody = [...parsed].sort((a, b) => a.position - b.position).map((s) => {
            let color = s.color;
            const alpha = (s.opacity ?? 100) / 100;
            if (alpha < 1 && color.startsWith("#")) {
              const h = color.replace("#", "");
              const r = parseInt(h.slice(0, 2), 16);
              const g = parseInt(h.slice(2, 4), 16);
              const b = parseInt(h.slice(4, 6), 16);
              color = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            }
            return `${color} ${Math.round(s.position * 100)}%`;
          }).join(", ");
        }
      } catch { /* fall through */ }
    }

    // Fallback to from/via/to
    if (!gradientBody && gradientFrom) {
      gradientBody = [gradientFrom, gradientVia, gradientTo].filter(Boolean).join(", ");
    }

    if (gradientBody) {
      if (gradientDirection === "radial") {
        inlineStyles.backgroundImage = `radial-gradient(${gradientBody})`;
      } else if (gradientDirection.startsWith("conic")) {
        const fromMatch = gradientDirection.match(/from (\d+)deg/);
        const fromStr = fromMatch ? `from ${fromMatch[1]}deg, ` : "";
        inlineStyles.backgroundImage = `conic-gradient(${fromStr}${gradientBody})`;
      } else {
        inlineStyles.backgroundImage = `linear-gradient(${gradientDirection}, ${gradientBody})`;
      }
    }
  }

  // ── Multi-fill stacking: overlay multiple fills via backgroundImage layers ──
  if (backgroundFillsJson) {
    try {
      const fills = JSON.parse(backgroundFillsJson) as { color: string; opacity: number; visible: boolean; gradient?: { type: string; angle: number; stops: { color: string; position: number; opacity?: number }[] } }[];
      if (Array.isArray(fills) && fills.length > 0) {
        const layers: string[] = [];
        for (const fill of fills) {
          if (fill.visible === false) continue;
          if (fill.gradient && fill.gradient.stops && fill.gradient.stops.length >= 2) {
            // Gradient fill layer
            const stopsCss = [...fill.gradient.stops].sort((a, b) => a.position - b.position).map((s) => {
              let color = s.color;
              const alpha = (s.opacity ?? 100) / 100;
              if (alpha < 1 && color.startsWith("#")) {
                const h = color.replace("#", "");
                const r = parseInt(h.slice(0, 2), 16);
                const g = parseInt(h.slice(2, 4), 16);
                const b = parseInt(h.slice(4, 6), 16);
                color = `rgba(${r}, ${g}, ${b}, ${alpha})`;
              }
              return `${color} ${Math.round(s.position * 100)}%`;
            }).join(", ");
            if (fill.gradient.type === "radial") {
              layers.push(`radial-gradient(${stopsCss})`);
            } else if (fill.gradient.type === "conic") {
              layers.push(`conic-gradient(from ${fill.gradient.angle}deg, ${stopsCss})`);
            } else {
              layers.push(`linear-gradient(${fill.gradient.angle}deg, ${stopsCss})`);
            }
          } else {
            // Solid color fill layer — use linear-gradient(color, color) so it can stack
            let color = fill.color;
            if (color.startsWith("#")) {
              const h = color.replace("#", "");
              const hex = h.length === 3 ? h[0]+h[0]+h[1]+h[1]+h[2]+h[2] : h;
              const alpha = (fill.opacity ?? 100) / 100;
              if (alpha < 1) {
                const r = parseInt(hex.slice(0, 2), 16);
                const g = parseInt(hex.slice(2, 4), 16);
                const b = parseInt(hex.slice(4, 6), 16);
                color = `rgba(${r}, ${g}, ${b}, ${alpha})`;
              } else {
                color = `#${hex}`;
              }
            }
            layers.push(`linear-gradient(${color}, ${color})`);
          }
        }
        if (layers.length > 0) {
          inlineStyles.backgroundImage = layers.join(", ");
          delete inlineStyles.backgroundColor; // Layers handle everything
        }
      }
    } catch { /* fall through to single-fill rendering */ }
  }

  // ── Compose filter/backdrop-filter from accumulated functions ──
  if (filterFns.length > 0) inlineStyles.filter = filterFns.join(' ');
  if (backdropFilterFns.length > 0) inlineStyles.backdropFilter = backdropFilterFns.join(' ');

  // ── Text gradient via background-clip: text ──
  if (textGradientJson) {
    try {
      const tg = JSON.parse(textGradientJson) as { type: string; angle: number; stops: { color: string; position: number; opacity?: number }[] };
      if (tg.stops && tg.stops.length >= 2) {
        const stopsCss = [...tg.stops].sort((a, b) => a.position - b.position).map((s) => {
          let color = s.color;
          const alpha = (s.opacity ?? 100) / 100;
          if (alpha < 1 && color.startsWith("#")) {
            const h = color.replace("#", "");
            const r = parseInt(h.slice(0, 2), 16);
            const g = parseInt(h.slice(2, 4), 16);
            const b = parseInt(h.slice(4, 6), 16);
            color = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          }
          return `${color} ${Math.round(s.position * 100)}%`;
        }).join(", ");

        if (tg.type === "radial") {
          inlineStyles.backgroundImage = `radial-gradient(${stopsCss})`;
        } else if (tg.type === "conic") {
          inlineStyles.backgroundImage = `conic-gradient(from ${tg.angle}deg, ${stopsCss})`;
        } else {
          inlineStyles.backgroundImage = `linear-gradient(${tg.angle}deg, ${stopsCss})`;
        }
        inlineStyles.backgroundClip = "text";
        (inlineStyles as Record<string, unknown>).WebkitBackgroundClip = "text";
        (inlineStyles as Record<string, unknown>).WebkitTextFillColor = "transparent";
        delete inlineStyles.color;
      }
    } catch { /* ignore bad JSON */ }
  }

  // Apply accumulated translate (uses CSS translate property, independent of rotate)
  if (hasTranslate) {
    inlineStyles.translate = `${translateParts[0]} ${translateParts[1]}`;
  }

  const result = { filteredClasses: secondPass.join(" "), inlineStyles };
  if (_extractCache.size >= EXTRACT_CACHE_MAX) _extractCache.clear();
  _extractCache.set(cacheKey, result);
  return result;
}

// Pages subscription for internal link resolution (rarely changes — only on page CRUD)
function usePages(): Page[] {
  const rawPages = useStorage((root) => root.pages);
  return useMemo(() => {
    if (!rawPages || (rawPages as any).size === 0) return [];
    const entries: [number, Page][] = Array.from((rawPages as any).entries());
    return entries
      .map(([, page]) => page)
      .sort((a, b) => a.order - b.order);
  }, [rawPages]);
}

interface RenderElementProps {
  elementId: string;
  isPreview?: boolean;
}

const RenderElement = React.memo(function RenderElement({ elementId, isPreview = false }: RenderElementProps) {
  // Granular element data — only re-renders when THIS element changes
  const element = useElement(elementId);

  // Granular UI state — each only re-renders on its specific change
  const isSelected = useIsSelected(elementId);
  const editingElementId = useEditingElementId();
  const isDragged = useDraggedId() === elementId;
  const device = useDevice();
  const previewFont = usePreviewFont();
  const isAdmin = useIsAdmin();

  // Stable callbacks — never change
  const {
    selectElement, toggleElementSelection, hoverElement, updateElement,
    setDragging, dropElement, isElementEffectivelyHidden, getEffectiveTarget,
    enterContainer, setFocusedContainer, setEditingElementId, setActivePageId,
    getElement,
  } = useEditorMutations();

  // Pages for internal link resolution — rarely changes (only on page CRUD)
  const pages = usePages();

  const effectivelyHidden = element ? isElementEffectivelyHidden(elementId) : false;
  const isLocked = !!element?.locked;

  const isEditing = editingElementId === elementId;
  const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(null);

  // In preview mode, derive device from viewport width for real responsive behavior
  const viewportDevice = useViewportDevice(isPreview);
  const renderDevice = isPreview ? viewportDevice : device;

  // Get style classes based on current device for responsive preview
  const rawStyleClasses = element ? getElementStyleClasses(element, renderDevice) : "";

  // Build combined inline styles (font family + extracted arbitrary values)
  const deviceStyles = element ? getElementEffectiveStyles(element, renderDevice) : null;

  // Extract arbitrary values and convert to inline styles
  // Tailwind JIT doesn't generate CSS for dynamically created arbitrary values like w-[300px]
  const { filteredClasses: styleClasses, inlineStyles: arbitraryStyles } = extractArbitraryStyles(rawStyleClasses, deviceStyles?.gradientStops, deviceStyles?.hiddenFilters, deviceStyles?.textGradient, deviceStyles?.backgroundFills);

  // Custom shadow: if custom shadow value fields exist, use generateBeautifulShadow() instead of preset
  if (deviceStyles) {
    const isInset = !!deviceStyles.insetShadow && deviceStyles.insetShadow !== "inset-shadow-none";
    const hasCustomShadow = isInset
      ? deviceStyles.insetShadowAngle !== undefined || deviceStyles.insetShadowDistance !== undefined || deviceStyles.insetShadowBrightness !== undefined || deviceStyles.insetShadowElevation !== undefined
      : deviceStyles.shadowAngle !== undefined || deviceStyles.shadowDistance !== undefined || deviceStyles.shadowBrightness !== undefined || deviceStyles.shadowElevation !== undefined;

    if (hasCustomShadow) {
      const presetKey = isInset ? deviceStyles.insetShadow : deviceStyles.shadow;
      const adapterPresets = isInset ? INSET_SHADOW_PRESETS : SHADOW_PRESETS;
      // Only override if there's actually a shadow preset set
      if (presetKey && presetKey in adapterPresets) {
        const basePreset = adapterPresets[presetKey];
        if (basePreset) {
          const sv: ShadowValue = { ...basePreset };
          if (isInset) {
            if (deviceStyles.insetShadowAngle !== undefined) sv.angle = parseFloat(deviceStyles.insetShadowAngle);
            if (deviceStyles.insetShadowDistance !== undefined) sv.distance = parseFloat(deviceStyles.insetShadowDistance);
            if (deviceStyles.insetShadowBrightness !== undefined) sv.brightness = parseFloat(deviceStyles.insetShadowBrightness);
            if (deviceStyles.insetShadowElevation !== undefined) sv.elevation = parseFloat(deviceStyles.insetShadowElevation);
          } else {
            if (deviceStyles.shadowAngle !== undefined) sv.angle = parseFloat(deviceStyles.shadowAngle);
            if (deviceStyles.shadowDistance !== undefined) sv.distance = parseFloat(deviceStyles.shadowDistance);
            if (deviceStyles.shadowBrightness !== undefined) sv.brightness = parseFloat(deviceStyles.shadowBrightness);
            if (deviceStyles.shadowElevation !== undefined) sv.elevation = parseFloat(deviceStyles.shadowElevation);
          }
          // Apply color override from shadowColor/insetShadowColor
          const colorCls = isInset ? deviceStyles.insetShadowColor : deviceStyles.shadowColor;
          if (colorCls) {
            const parsed = parseShadowColorClass(colorCls);
            if (parsed) { sv.color = parsed.color; sv.opacity = parsed.opacity; }
          }
          arbitraryStyles.boxShadow = generateBeautifulShadow(sv);
        }
      }
    }
  }

  const effectiveFont =
    isSelected && previewFont ? previewFont : deviceStyles?.fontFamily;
  const elementStyle: React.CSSProperties = {
    ...(effectiveFont ? { fontFamily: `'${effectiveFont}', sans-serif` } : {}),
    ...arbitraryStyles,
    whiteSpace: "pre-line",
  };

  // In edit mode, override position:fixed → position:absolute so fixed elements
  // are contained by the artboard (which has position:absolute) instead of escaping
  // to the world div (which captures fixed positioning via willChange:transform).
  // This fixes both positioning (top:0 = artboard top, not world origin) and
  // width:100% (resolves to artboard width, not world width).
  // In preview mode, position:fixed works correctly relative to the viewport.
  if (!isPreview && deviceStyles?.position === "fixed") {
    elementStyle.position = "absolute";
  }

  const wrapperClasses = cn(
    "relative",
    !isPreview && "cursor-[inherit]",
    isDragged && "opacity-50",
    dropPosition === "before" && "border-t-2 border-t-primary",
    dropPosition === "after" && "border-b-2 border-b-primary"
  );

  // Render children for container types
  const renderChildren = () => {
    if (!element?.children?.length) return null;
    return element.children.map((childId) => (
      <RenderElement key={childId} elementId={childId} isPreview={isPreview} />
    ));
  };

  // Render content — uses TiptapTextEditor for rich text editing
  const renderEditableContent = () => {
    if (isEditing && !isPreview) {
      return (
        <TiptapTextEditor
          initialContent={element?.richContent || element?.content || ""}
          onSave={(richContent, plainText) => {
            updateElement(elementId, { richContent: richContent as JsonObject, content: plainText });
          }}
          onExit={() => setEditingElementId(null)}
        />
      );
    }
    // Content effect: render inline in preview mode (inherits all CSS from parent)
    if (isPreview && element?.reactEffect) {
      const effect = parseReactEffect(element.reactEffect);
      if (effect && effect.type !== "css" && effect.placement === "content") {
        return <InlineEffectWrapper effect={effect} content={element.content || ""} />;
      }
    }
    // Static rich text rendering
    if (element?.richContent) {
      let html = generateHTML(
        element.richContent as Parameters<typeof generateHTML>[0],
        EDITOR_EXTENSIONS
      );
      // Sanitize HTML to prevent XSS from user-generated rich content.
      html = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'a', 'span', 'sub', 'sup', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'class'],
      });
      // In edit mode, neutralize inline <a> tags so they don't navigate on click.
      if (!isPreview) {
        html = html.replace(/<a\s/g, '<a onclick="return false" ');
      }
      return <span dangerouslySetInnerHTML={{ __html: html }} />;
    }
    return element?.content;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isPreview) return;
    e.stopPropagation();

    // When editing text, let clicks through for cursor placement — don't run selection logic
    if (isEditing) return;

    // If a marquee drag just finished (Cmd+drag), skip — selection was set by marquee
    if (marqueeFlag.didMarquee) {
      marqueeFlag.didMarquee = false;
      return;
    }

    // Skip if canvas wrapper already handled selection via pointerdown
    if (canvasDragFlag.didDrag) {
      canvasDragFlag.didDrag = false;
      return;
    }

    const isMod = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;
    const focusedId = editorStateStore.getSnapshot().focusedContainerId;

    if (isMod && isShift) {
      // Cmd+Shift+Click: Deep select + add to selection
      toggleElementSelection(elementId);
    } else if (isMod) {
      // Cmd+Click: Deep select (bypass focus level)
      selectElement(elementId);
    } else if (isShift) {
      // Shift+Click: Toggle at focus level (matches Figma)
      const effectiveId = getEffectiveTarget(elementId, focusedId);
      if (effectiveId) {
        toggleElementSelection(effectiveId);
      }
    } else {
      // Normal click: Focus-aware single select
      const effectiveId = getEffectiveTarget(elementId, focusedId);
      if (effectiveId) {
        selectElement(effectiveId);
      } else {
        // Clicked element is not inside the focused container —
        // exit to page level and select the root-level ancestor
        setFocusedContainer(null);
        const rootId = getEffectiveTarget(elementId, null);
        if (rootId) {
          selectElement(rootId);
        }
      }
    }
  };

  // Track last hover target to avoid redundant calls on every mousemove
  const lastHoverRef = useRef<string | null>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPreview) return;
    if (editingElementId) return; // Don't change hover state while any element is being text-edited
    const isMod = e.metaKey || e.ctrlKey;
    if (isMod) {
      // Cmd+hover: deep element preview — stop propagation so parent doesn't override
      e.stopPropagation();
      if (elementId !== lastHoverRef.current) {
        lastHoverRef.current = elementId;
        hoverElement(elementId);
      }
    } else {
      // Normal hover: focus-level target (matches normal click)
      const hoverId = getEffectiveTarget(elementId, editorStateStore.getSnapshot().focusedContainerId) ?? elementId;
      if (hoverId !== lastHoverRef.current) {
        lastHoverRef.current = hoverId;
        hoverElement(hoverId);
      }
    }
  };

  const handleMouseLeave = () => {
    if (isPreview) return;
    lastHoverRef.current = null;
    hoverElement(null);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isPreview) return;
    e.stopPropagation();

    // When already editing text, let double-clicks through for word selection — don't re-run selection logic
    if (editingElementId) return;

    const isMod = e.metaKey || e.ctrlKey;

    if (isMod) {
      // Cmd+double-click: bypass focus level, act on actual clicked element
      if (!element) return;
      if (element.type === "container") {
        enterContainer(elementId);
        return;
      }
      if (isLocked || ((element.isCore || element.textLocked) && !isAdmin)) return;
      if (["heading", "text", "button", "badge"].includes(element.type || "")) {
        setEditingElementId(elementId);
      }
      return;
    }

    // Normal double-click: use focus-level targeting
    const focusedId = editorStateStore.getSnapshot().focusedContainerId;
    const effectiveId = getEffectiveTarget(elementId, focusedId);
    // If element is outside the focused container, handle like a click outside
    if (!effectiveId && focusedId) {
      setFocusedContainer(null);
      return;
    }
    const targetId = effectiveId || elementId;
    const targetElement = targetId === elementId ? element : getElement(targetId);
    if (!targetElement) return;

    // If effective target is a container, enter it
    if (targetElement.type === "container") {
      enterContainer(targetId);
      return;
    }

    // Only allow text editing if the element is at the current focus level
    if (targetId !== elementId) return; // Element is deeper than focus — don't edit

    // If text-like, enter inline editing (existing behavior)
    if (isLocked || ((targetElement.isCore || targetElement.textLocked) && !isAdmin)) return;
    if (["heading", "text", "button", "badge"].includes(targetElement.type || "")) {
      setEditingElementId(elementId);
    }
  };



  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent) => {
    if (isPreview || isLocked || editingElementId) { e.preventDefault(); return; }
    e.stopPropagation();
    e.dataTransfer.setData("text/plain", elementId);
    e.dataTransfer.effectAllowed = "move";
    setDragging(true, elementId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isPreview || isDragged) return;
    e.preventDefault();
    e.stopPropagation();

    // Determine drop position based on cursor location
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? "before" : "after";
    setDropPosition(position);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setDropPosition(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (isPreview) return;
    e.preventDefault();
    e.stopPropagation();

    if (dropPosition && !isDragged) {
      dropElement(elementId, dropPosition);
    }
    setDropPosition(null);
  };

  const handleDragEnd = () => {
    setDragging(false, null);
    setDropPosition(null);
  };

  const commonProps = {
    "data-element-id": elementId,
    onClick: handleClick,
    onMouseDown: isEditing ? (e: React.MouseEvent) => {
      // When editing text, prevent mousedown outside the contentEditable from
      // stealing focus. Without this, clicking past the last character blurs the
      // editor, exits editing mode, and the subsequent drag moves the element.
      const target = e.target as HTMLElement;
      if (!target.closest('[contenteditable="true"]')) {
        e.preventDefault();
      }
    } : undefined,
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    onDoubleClick: handleDoubleClick,
    onContextMenu: (e: React.MouseEvent) => {
      if (isPreview) return;
      if (isEditing) {
        e.preventDefault();
        e.stopPropagation();
        elementContextMenuRef.openText?.(e.clientX, e.clientY, elementId);
        return;
      }
      if (canvasDragFlag.didDrag) return;
      e.preventDefault();
      e.stopPropagation();
      // Resolve to effective target (e.g. container when not focused into it)
      const snap = editorStateStore.getSnapshot();
      const effectiveId = getEffectiveTarget(elementId, snap.focusedContainerId) ?? elementId;
      // Right-click selects the element (Figma behavior)
      if (!snap.selectedIds.includes(effectiveId)) {
        selectElement(effectiveId);
      }
      elementContextMenuRef.open?.(e.clientX, e.clientY, effectiveId);
    },
    draggable: !isPreview && !editingElementId && !isLocked && !spatialDragFlag.active,
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
    onDragEnd: handleDragEnd,
  };


  const elementFontFamily = element?.tailwindStyles?.fontFamily;
  useEffect(() => {
    if (elementFontFamily) {
      loadGoogleFont(elementFontFamily);
    }
  }, [elementFontFamily]);

  useEffect(() => {
    if (isSelected && previewFont) {
      loadGoogleFont(previewFont);
    }
  }, [isSelected, previewFont]);

  // Memoize parsed shader config so hover re-renders don't reinit the GPU renderer
  const parsedShaderConfig = useMemo(() => {
    if (!element?.shaderConfig) return null;
    try { return JSON.parse(element.shaderConfig); } catch { return null; }
  }, [element?.shaderConfig]);

  // Shader auto-chain: find the shader element directly below in z-order (for post-process shaders).
  // Uses useStorage selector so only re-renders when the actual source shader changes.
  const isPostProcessShader = !!parsedShaderConfig && (
    parsedShaderConfig.postProcess || parsedShaderConfig.preset === "chromatic-aberration" || parsedShaderConfig.preset === "crt"
  );
  const myZIndex = element?.zIndex || 0;
  const shaderAutoSourceRaw = useStorage((root) => {
    if (!isPostProcessShader) return undefined;
    const allElements = root.elements;
    if (!allElements) return undefined;
    let bestId: string | undefined;
    let bestZ = -Infinity;
    allElements.forEach((el, id) => {
      if (id === elementId || el.type !== "shader" || !el.shaderConfig) return;
      const z = el.zIndex || 0;
      if (z < myZIndex && z > bestZ) {
        bestZ = z;
        bestId = id;
      }
    });
    return bestId ? `shader-el-${bestId}` : undefined;
  });
  const shaderAutoSource = shaderAutoSourceRaw ?? undefined;

  if (!element) return null;

  // Hidden elements: completely invisible on canvas
  if (effectivelyHidden) return null;

  // Shader layers: text elements use text-fill mode (background-clip: text),
  // all other elements use overlay mode (absolutely positioned canvases).
  const isTextLike = element.type === "text" || element.type === "heading"
    || element.type === "button" || element.type === "badge" || element.type === "link";
  const shaderOverlay = element.shaderLayers && !isTextLike ? (
    <ElementShaderLayers
      shaderLayersJson={element.shaderLayers}
      elementId={elementId}
      contentSrc={element.content}
    />
  ) : null;
  const shaderTextFill = element.shaderLayers && isTextLike ? (
    <ShaderTextFill
      shaderLayersJson={element.shaderLayers}
      elementId={elementId}
    />
  ) : null;

  // Link wrapping: any element with element.link wraps in an <a>
  const elementLink = element.link;
  const hasLink = elementLink && elementLink.url.trim().length > 0;

  const wrapWithLink = (content: JSX.Element | null): JSX.Element | null => {
    if (!hasLink) return content;
    // In edit mode, don't wrap with <a> — prevents accidental navigation.
    // Link info is shown in the property panel; preview mode handles real navigation.
    if (!isPreview) return content;

    // Internal page link handling
    const isInternal = elementLink && isInternalLink(elementLink.url);
    const targetPageId = isInternal ? parseInternalLink(elementLink!.url) : null;
    const targetPage = targetPageId ? pages.find(p => p.id === targetPageId) : null;

    if (isInternal) {
      const tooltipText = targetPage
        ? `Go to: ${targetPage.name}`
        : "Broken link";

      const inner = !isPreview ? (
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="top" shortcut={isMac ? "\u21E7\u2318+click" : "Ctrl+Shift+click"}>
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      ) : content;

      return (
        <a
          href="#"
          onClickCapture={(e) => {
            if (!isPreview) {
              // Cmd+Shift+Click navigates to the internal page
              if ((e.metaKey || e.ctrlKey) && e.shiftKey && targetPage) {
                e.preventDefault();
                e.stopPropagation();
                setActivePageId(targetPageId!);
                return;
              }
              e.preventDefault();
            } else {
              // Preview mode: navigate via SPA
              e.preventDefault();
              if (targetPage) {
                setActivePageId(targetPageId!);
              }
            }
          }}
          className="contents"
        >
          {inner}
        </a>
      );
    }

    // External link (original behavior)
    const inner = !isPreview ? (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="top" shortcut={isMac ? "\u21E7\u2318+click" : "Ctrl+Shift+click"}>
          Open link
        </TooltipContent>
      </Tooltip>
    ) : content;
    return (
      <a
        href={elementLink!.url}
        target={elementLink!.target}
        rel={elementLink!.target === "_blank" ? "noopener noreferrer" : undefined}
        onClickCapture={(e) => {
          if (!isPreview) {
            // Cmd+Shift+Click opens the link; Cmd+Click alone is deep-select
            if ((e.metaKey || e.ctrlKey) && e.shiftKey) return;
            e.preventDefault();
          }
        }}
        className="contents"
      >
        {inner}
      </a>
    );
  };

  switch (element.type) {
    case "heading": {
      const HeadingTag = isEditing ? "div" : "h2";
      const headingStyle = shaderTextFill
        ? { ...elementStyle, backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties
        : elementStyle;
      return wrapWithLink(
        <HeadingTag className={cn(wrapperClasses, styleClasses)} style={headingStyle} {...commonProps}>
          {renderEditableContent()}
          {shaderTextFill}
        </HeadingTag>
      );
    }

    case "text": {
      const TextTag = isEditing || shaderTextFill ? "div" : "p";
      const textStyle = shaderTextFill
        ? { ...elementStyle, backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties
        : elementStyle;
      return wrapWithLink(
        <TextTag className={cn(wrapperClasses, styleClasses)} style={textStyle} {...commonProps}>
          {renderEditableContent()}
          {shaderTextFill}
        </TextTag>
      );
    }

    case "button": {
      const ButtonTag = isEditing || shaderTextFill ? "div" : "button";
      const buttonStyle = shaderTextFill
        ? { ...elementStyle, backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties
        : elementStyle;
      return wrapWithLink(
        <ButtonTag
          {...(ButtonTag === "button" ? { type: "button" as const } : {})}
          className={cn(wrapperClasses, styleClasses, "inline-flex items-center justify-center")}
          style={buttonStyle}
          {...commonProps}
        >
          {renderEditableContent()}
          {shaderTextFill}
        </ButtonTag>
      );
    }

    case "badge": {
      const BadgeTag = isEditing || shaderTextFill ? "div" : "span";
      const badgeStyle = shaderTextFill
        ? { ...elementStyle, backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties
        : elementStyle;
      return wrapWithLink(
        <BadgeTag
          className={cn(wrapperClasses, styleClasses, "inline-flex items-center")}
          style={badgeStyle}
          {...commonProps}
        >
          {renderEditableContent()}
          {shaderTextFill}
        </BadgeTag>
      );
    }

    case "link": {
      const linkData = element.link;
      const linkUrl = linkData?.url?.trim()
        ? linkData.url
        : element.content?.startsWith('http')
          ? element.content
          : element.content?.includes('@')
            ? `mailto:${element.content}`
            : `https://${element.content}`;
      const linkTarget = linkData?.target ?? "_blank";

      // Internal page link handling for "link" element type
      const isLinkInternal = isInternalLink(linkUrl);
      const linkTargetPageId = isLinkInternal ? parseInternalLink(linkUrl) : null;
      const linkTargetPage = linkTargetPageId ? pages.find(p => p.id === linkTargetPageId) : null;

      return (
        <a
          href={isLinkInternal ? "#" : linkUrl}
          target={isLinkInternal ? undefined : linkTarget}
          rel={!isLinkInternal && linkTarget === "_blank" ? "noopener noreferrer" : undefined}
          className={cn(wrapperClasses, styleClasses)}
          style={shaderTextFill
            ? { ...elementStyle, backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties
            : elementStyle}
          {...commonProps}
          onClickCapture={(e) => {
            if (isLinkInternal) {
              e.preventDefault();
              if (isPreview && linkTargetPage) {
                setActivePageId(linkTargetPageId!);
              } else if (!isPreview) {
                if ((e.metaKey || e.ctrlKey) && linkTargetPage) {
                  e.stopPropagation();
                  setActivePageId(linkTargetPageId!);
                }
              }
            } else if (!isPreview) {
              if (e.metaKey || e.ctrlKey) return;
              e.preventDefault();
            }
          }}
        >
          {renderEditableContent()}
          {shaderTextFill}
        </a>
      );
    }

    case "image": {
      // Backward compat: existing image elements with video URLs still render as video
      const isVideo = element.content?.match(/\.(mp4|mov|webm|ogg)$/i);
      // Split styles: objectFit/objectPosition go to the media element, rest to wrapper
      const { objectFit, objectPosition, ...imageWrapperStyle } = elementStyle as any;
      const imageMediaStyle: React.CSSProperties = {};
      if (objectFit) imageMediaStyle.objectFit = objectFit;
      if (objectPosition) imageMediaStyle.objectPosition = objectPosition;
      return wrapWithLink(
        <div className={cn(wrapperClasses, styleClasses, "overflow-hidden")} style={imageWrapperStyle} {...commonProps}>
          {isVideo ? (
            <video
              src={element.content}
              className="w-full h-full"
              style={imageMediaStyle}
              controls
              loop
              muted
              playsInline
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={element.content || "/placeholder.svg"}
              alt={element.alt || ""}
              crossOrigin="anonymous"
              className="w-full h-full"
              style={imageMediaStyle}
            />
          )}
          {shaderOverlay}
        </div>
      );
    }

    case "gif": {
      const { objectFit: gifObjFit, objectPosition: gifObjPos, ...gifWrapperStyle } = elementStyle as any;
      const gifMediaStyle: React.CSSProperties = {};
      if (gifObjFit) gifMediaStyle.objectFit = gifObjFit;
      if (gifObjPos) gifMediaStyle.objectPosition = gifObjPos;
      return wrapWithLink(
        <div className={cn(wrapperClasses, styleClasses, "overflow-hidden")} style={gifWrapperStyle} {...commonProps}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={element.content || "/placeholder.svg"}
            alt={element.alt || "GIF"}
            crossOrigin="anonymous"
            className="w-full h-full"
            style={gifMediaStyle}
          />
          {shaderOverlay}
        </div>
      );
    }

    case "video": {
      const { objectFit: vidObjFit, objectPosition: vidObjPos, ...videoWrapperStyle } = elementStyle as any;
      const videoMediaStyle: React.CSSProperties = {};
      if (vidObjFit) videoMediaStyle.objectFit = vidObjFit;
      if (vidObjPos) videoMediaStyle.objectPosition = vidObjPos;
      return wrapWithLink(
        <div className={cn(wrapperClasses, styleClasses, "overflow-hidden")} style={videoWrapperStyle} {...commonProps}>
          <video
            src={element.content || undefined}
            className="w-full h-full"
            style={videoMediaStyle}
            autoPlay={element.videoAutoplay ?? true}
            loop={element.videoLoop ?? true}
            controls={element.videoControls ?? false}
            muted={element.videoMuted ?? true}
            playsInline
          />
          {shaderOverlay}
        </div>
      );
    }

    case "divider":
      return wrapWithLink(<hr className={cn(wrapperClasses, styleClasses)} style={elementStyle} {...commonProps} />);

    case "container":
      return wrapWithLink(
        <div className={cn(wrapperClasses, styleClasses)} style={elementStyle} {...commonProps}>
          {shaderOverlay && (
            <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
              {shaderOverlay}
            </div>
          )}
          {renderChildren()}
        </div>
      );

    case "sticker":
      return wrapWithLink(
        <div className={cn(wrapperClasses, "text-4xl")} {...commonProps}>
          {element.content}
          {shaderOverlay}
        </div>
      );

    case "component":
      return (
        <div className={cn(wrapperClasses, styleClasses)} style={elementStyle} {...commonProps}>
          <div style={{ pointerEvents: isPreview ? "auto" : "none" }}>
            <PodcastComponentRenderer componentName={element.componentName!} />
          </div>
          {shaderOverlay}
        </div>
      );

    case "rectangle":
    case "circle":
    case "star": {
      const { stroke, strokeWidth, fill, fillOpacity } = getShapeSvgProps(element.tailwindStyles);
      const shapeClasses = element.tailwindStyles ? getStyleClasses(Object.fromEntries(Object.entries(element.tailwindStyles).filter(([k]) => !k.startsWith('border') && k !== 'backgroundColor')) as TailwindStyles) : '';
      // Strip backgroundColor, backgroundImage, and border inline styles from wrapper
      // — solid fill and gradient are applied to the shape, not the bounding box
      const { backgroundColor: _bg, backgroundImage: _bgImg, borderColor: _bc, borderWidth: _bw, borderStyle: _bs, ...shapeInlineStyle } = elementStyle as any;

      const gradientImage = (elementStyle as any).backgroundImage as string | undefined;
      const hasGradient = !!gradientImage;
      // When gradient is present, SVG fill is none so the gradient overlay shows through
      const effectiveFill = hasGradient ? "none" : fill;

      // Clip-path for gradient overlay — clips gradient to the shape outline
      const shapeClipPath = element.type === "circle"
        ? "ellipse(50% 50% at 50% 50%)"
        : element.type === "star"
          ? "polygon(50% 2%, 61% 35%, 97% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 3% 35%, 39% 35%)"
          : undefined; // rectangle: no clip needed

      const svgContent = (() => {
        switch (element.type) {
          case 'rectangle':
            return <rect width="100" height="100" fill={effectiveFill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />;
          case 'circle':
            return <ellipse cx="50" cy="50" rx="49" ry="49" fill={effectiveFill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />;
          case 'star':
            return <polygon points="50,2 61,35 97,35 68,57 79,91 50,70 21,91 32,57 3,35 39,35" fill={effectiveFill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />;
        }
      })();

      return wrapWithLink(
        <div className={cn(wrapperClasses, shapeClasses)} style={shapeInlineStyle} {...commonProps}>
          {hasGradient && (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: gradientImage,
                clipPath: shapeClipPath,
              }}
            />
          )}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="w-full h-full block relative"
          >
            {svgContent}
          </svg>
          {shaderOverlay && shapeClipPath ? (
            <div className="absolute inset-0" style={{ clipPath: shapeClipPath, pointerEvents: "none" }}>
              {shaderOverlay}
            </div>
          ) : shaderOverlay}
        </div>
      );
    }

    case "shader": {
      // Show placeholder only when no config; otherwise always render live
      if (!parsedShaderConfig) {
        return (
          <div className={cn(wrapperClasses, styleClasses)} style={elementStyle} {...commonProps}>
            <div className="w-full h-full flex items-center justify-center bg-stone-100 dark:bg-stone-800/50 rounded-md">
              <span className="text-[11px] font-medium text-stone-400 dark:text-stone-500 select-none">
                {element.name || element.shaderPreset || "Shader"}
              </span>
            </div>
          </div>
        );
      }

      if (element.shaderSystem === "particle") {
        return (
          <div className={cn(wrapperClasses, styleClasses)} style={elementStyle} {...commonProps}>
            <div className="w-full h-full flex items-center justify-center bg-stone-100 dark:bg-stone-800/50 rounded-md">
              <span className="text-[11px] font-medium text-stone-400 dark:text-stone-500 select-none">
                Particle effects moved to Animations
              </span>
            </div>
          </div>
        );
      }

      // Auto-chain: for postProcess (transformative) shaders, read from the
      // shader element directly below in z-order. Generative shaders blend via CSS.
      const isPostProcess = parsedShaderConfig.postProcess || parsedShaderConfig.preset === "chromatic-aberration" || parsedShaderConfig.preset === "crt";
      const autoSourceCanvasId = isPostProcess ? shaderAutoSource : undefined;

      return (
        <div className={cn(wrapperClasses, styleClasses)} style={{ ...elementStyle, overflow: "visible" }} {...commonProps}>
          <ShaderRenderer
            config={isPostProcess && !parsedShaderConfig.postProcess ? { ...parsedShaderConfig, postProcess: true } : parsedShaderConfig}
            active
            canvasId={`shader-el-${elementId}`}
            sourceCanvasId={autoSourceCanvasId}
            preserveDrawingBuffer
          />
        </div>
      );
    }

    default:
      return null;
  }
});

// Split page TailwindStyles into appearance (outer div) and layout (inner div)
function splitPageTailwind(tw: Partial<TailwindStyles>): {
  appearance: Partial<TailwindStyles>;
  layout: Partial<TailwindStyles>;
} {
  const LAYOUT_KEYS = new Set([
    'display', 'flexDirection', 'justifyContent', 'alignItems',
    'flexWrap', 'gap', 'customClasses',
  ]);
  const appearance: Partial<TailwindStyles> = {};
  const layout: Partial<TailwindStyles> = {};
  for (const [k, v] of Object.entries(tw)) {
    if (k === 'fontFamily') continue; // handled separately as inline style
    if (LAYOUT_KEYS.has(k)) (layout as Record<string, unknown>)[k] = v;
    else (appearance as Record<string, unknown>)[k] = v;
  }
  return { appearance, layout };
}

// Convert Tailwind color class to actual color value
function tailwindToColor(className: string): string {
  if (!className) return "";

  // Handle raw hex values (e.g. from FillSection / ColorPicker)
  if (className.startsWith("#")) return className;

  // Handle arbitrary values like bg-[#ff0000] or text-[#ff0000]
  const arbitraryMatch = className.match(/\[#([a-fA-F0-9]{3,8})\]/);
  if (arbitraryMatch) {
    return `#${arbitraryMatch[1]}`;
  }

  // Handle gradient colors (from-*, via-*, to-*)
  const gradientMatch = className.match(/^(from|via|to)-(.+)/);
  if (gradientMatch) {
    className = `bg-${gradientMatch[2]}`;
  }

  // Handle border color classes like border-stone-400
  const borderMatch = className.match(/^border-(.+)/);
  if (borderMatch && !className.startsWith('border-[')) {
    className = `bg-${borderMatch[1]}`;
  }

  return COLOR_SWATCHES[className] || "";
}

// Tailwind color class -> CSS color value lookup map (precomputed at module level)
const COLOR_SWATCHES: Record<string, string> = {
    // Theme colors
    "bg-background": "hsl(var(--background))",
    "bg-card": "hsl(var(--card))",
    "bg-muted": "hsl(var(--muted))",
    "bg-popover": "hsl(var(--popover))",
    "bg-primary": "hsl(var(--primary))",
    "bg-secondary": "hsl(var(--secondary))",
    "bg-accent": "hsl(var(--accent))",
    "text-foreground": "hsl(var(--foreground))",
    "text-muted-foreground": "hsl(var(--muted-foreground))",
    "text-primary": "hsl(var(--primary))",
    // Tailwind colors - comprehensive list
    "bg-white": "#ffffff", "text-white": "#ffffff",
    "bg-black": "#000000", "text-black": "#000000",
    "bg-slate-50": "#f8fafc", "bg-slate-100": "#f1f5f9", "bg-slate-200": "#e2e8f0", "bg-slate-300": "#cbd5e1",
    "bg-slate-400": "#94a3b8", "bg-slate-500": "#64748b", "bg-slate-600": "#475569", "bg-slate-700": "#334155",
    "bg-slate-800": "#1e293b", "bg-slate-900": "#0f172a", "bg-slate-950": "#020617",
    "bg-stone-50": "#f9fafb", "bg-stone-100": "#f3f4f6", "bg-stone-200": "#e5e7eb", "bg-stone-300": "#d1d5db",
    "bg-stone-400": "#9ca3af", "bg-stone-500": "#6b7280", "bg-stone-600": "#4b5563", "bg-stone-700": "#374151",
    "bg-stone-800": "#1f2937", "bg-stone-900": "#111827", "bg-stone-950": "#030712",
    "bg-zinc-50": "#fafafa", "bg-zinc-100": "#f4f4f5", "bg-zinc-200": "#e4e4e7", "bg-zinc-300": "#d4d4d8",
    "bg-zinc-400": "#a1a1aa", "bg-zinc-500": "#71717a", "bg-zinc-600": "#52525b", "bg-zinc-700": "#3f3f46",
    "bg-zinc-800": "#27272a", "bg-zinc-900": "#18181b", "bg-zinc-950": "#09090b",
    "bg-red-50": "#fef2f2", "bg-red-100": "#fee2e2", "bg-red-200": "#fecaca", "bg-red-300": "#fca5a5",
    "bg-red-400": "#f87171", "bg-red-500": "#ef4444", "bg-red-600": "#dc2626", "bg-red-700": "#b91c1c",
    "bg-red-800": "#991b1b", "bg-red-900": "#7f1d1d", "bg-red-950": "#450a0a",
    "bg-orange-50": "#fff7ed", "bg-orange-100": "#ffedd5", "bg-orange-200": "#fed7aa", "bg-orange-300": "#fdba74",
    "bg-orange-400": "#fb923c", "bg-orange-500": "#f97316", "bg-orange-600": "#ea580c", "bg-orange-700": "#c2410c",
    "bg-orange-800": "#9a3412", "bg-orange-900": "#7c2d12", "bg-orange-950": "#431407",
    "bg-amber-50": "#fffbeb", "bg-amber-100": "#fef3c7", "bg-amber-200": "#fde68a", "bg-amber-300": "#fcd34d",
    "bg-amber-400": "#fbbf24", "bg-amber-500": "#f59e0b", "bg-amber-600": "#d97706", "bg-amber-700": "#b45309",
    "bg-amber-800": "#92400e", "bg-amber-900": "#78350f", "bg-amber-950": "#451a03",
    "bg-yellow-50": "#fefce8", "bg-yellow-100": "#fef9c3", "bg-yellow-200": "#fef08a", "bg-yellow-300": "#fde047",
    "bg-yellow-400": "#facc15", "bg-yellow-500": "#eab308", "bg-yellow-600": "#ca8a04", "bg-yellow-700": "#a16207",
    "bg-yellow-800": "#854d0e", "bg-yellow-900": "#713f12", "bg-yellow-950": "#422006",
    "bg-lime-50": "#f7fee7", "bg-lime-100": "#ecfccb", "bg-lime-200": "#d9f99d", "bg-lime-300": "#bef264",
    "bg-lime-400": "#a3e635", "bg-lime-500": "#84cc16", "bg-lime-600": "#65a30d", "bg-lime-700": "#4d7c0f",
    "bg-lime-800": "#3f6212", "bg-lime-900": "#365314", "bg-lime-950": "#1a2e05",
    "bg-green-50": "#f0fdf4", "bg-green-100": "#dcfce7", "bg-green-200": "#bbf7d0", "bg-green-300": "#86efac",
    "bg-green-400": "#4ade80", "bg-green-500": "#22c55e", "bg-green-600": "#16a34a", "bg-green-700": "#15803d",
    "bg-green-800": "#166534", "bg-green-900": "#14532d", "bg-green-950": "#052e16",
    "bg-emerald-50": "#ecfdf5", "bg-emerald-100": "#d1fae5", "bg-emerald-200": "#a7f3d0", "bg-emerald-300": "#6ee7b7",
    "bg-emerald-400": "#34d399", "bg-emerald-500": "#10b981", "bg-emerald-600": "#059669", "bg-emerald-700": "#047857",
    "bg-emerald-800": "#065f46", "bg-emerald-900": "#064e3b", "bg-emerald-950": "#022c22",
    "bg-teal-50": "#f0fdfa", "bg-teal-100": "#ccfbf1", "bg-teal-200": "#99f6e4", "bg-teal-300": "#5eead4",
    "bg-teal-400": "#2dd4bf", "bg-teal-500": "#14b8a6", "bg-teal-600": "#0d9488", "bg-teal-700": "#0f766e",
    "bg-teal-800": "#115e59", "bg-teal-900": "#134e4a", "bg-teal-950": "#042f2e",
    "bg-cyan-50": "#ecfeff", "bg-cyan-100": "#cffafe", "bg-cyan-200": "#a5f3fc", "bg-cyan-300": "#67e8f9",
    "bg-cyan-400": "#22d3ee", "bg-cyan-500": "#06b6d4", "bg-cyan-600": "#0891b2", "bg-cyan-700": "#0e7490",
    "bg-cyan-800": "#155e75", "bg-cyan-900": "#164e63", "bg-cyan-950": "#083344",
    "bg-sky-50": "#f0f9ff", "bg-sky-100": "#e0f2fe", "bg-sky-200": "#bae6fd", "bg-sky-300": "#7dd3fc",
    "bg-sky-400": "#38bdf8", "bg-sky-500": "#0ea5e9", "bg-sky-600": "#0284c7", "bg-sky-700": "#0369a1",
    "bg-sky-800": "#075985", "bg-sky-900": "#0c4a6e", "bg-sky-950": "#082f49",
    "bg-blue-50": "#eff6ff", "bg-blue-100": "#dbeafe", "bg-blue-200": "#bfdbfe", "bg-blue-300": "#93c5fd",
    "bg-blue-400": "#60a5fa", "bg-blue-500": "#3b82f6", "bg-blue-600": "#2563eb", "bg-blue-700": "#1d4ed8",
    "bg-blue-800": "#1e40af", "bg-blue-900": "#1e3a8a", "bg-blue-950": "#172554",
    "bg-indigo-50": "#eef2ff", "bg-indigo-100": "#e0e7ff", "bg-indigo-200": "#c7d2fe", "bg-indigo-300": "#a5b4fc",
    "bg-indigo-400": "#818cf8", "bg-indigo-500": "#6366f1", "bg-indigo-600": "#4f46e5", "bg-indigo-700": "#4338ca",
    "bg-indigo-800": "#3730a3", "bg-indigo-900": "#312e81", "bg-indigo-950": "#1e1b4b",
    "bg-violet-50": "#f5f3ff", "bg-violet-100": "#ede9fe", "bg-violet-200": "#ddd6fe", "bg-violet-300": "#c4b5fd",
    "bg-violet-400": "#a78bfa", "bg-violet-500": "#8b5cf6", "bg-violet-600": "#7c3aed", "bg-violet-700": "#6d28d9",
    "bg-violet-800": "#5b21b6", "bg-violet-900": "#4c1d95", "bg-violet-950": "#2e1065",
    "bg-purple-50": "#faf5ff", "bg-purple-100": "#f3e8ff", "bg-purple-200": "#e9d5ff", "bg-purple-300": "#d8b4fe",
    "bg-purple-400": "#c084fc", "bg-purple-500": "#a855f7", "bg-purple-600": "#9333ea", "bg-purple-700": "#7e22ce",
    "bg-purple-800": "#6b21a8", "bg-purple-900": "#581c87", "bg-purple-950": "#3b0764",
    "bg-fuchsia-50": "#fdf4ff", "bg-fuchsia-100": "#fae8ff", "bg-fuchsia-200": "#f5d0fe", "bg-fuchsia-300": "#f0abfc",
    "bg-fuchsia-400": "#e879f9", "bg-fuchsia-500": "#d946ef", "bg-fuchsia-600": "#c026d3", "bg-fuchsia-700": "#a21caf",
    "bg-fuchsia-800": "#86198f", "bg-fuchsia-900": "#701a75", "bg-fuchsia-950": "#4a044e",
    "bg-pink-50": "#fdf2f8", "bg-pink-100": "#fce7f3", "bg-pink-200": "#fbcfe8", "bg-pink-300": "#f9a8d4",
    "bg-pink-400": "#f472b6", "bg-pink-500": "#ec4899", "bg-pink-600": "#db2777", "bg-pink-700": "#be185d",
    "bg-pink-800": "#9d174d", "bg-pink-900": "#831843", "bg-pink-950": "#500724",
    "bg-rose-50": "#fff1f2", "bg-rose-100": "#ffe4e6", "bg-rose-200": "#fecdd3", "bg-rose-300": "#fda4af",
    "bg-rose-400": "#fb7185", "bg-rose-500": "#f43f5e", "bg-rose-600": "#e11d48", "bg-rose-700": "#be123c",
    "bg-rose-800": "#9f1239", "bg-rose-900": "#881337", "bg-rose-950": "#4c0519",
};
// Precompute text- variants for all bg- colors once at module level
for (const key of Object.keys(COLOR_SWATCHES)) {
  if (key.startsWith("bg-")) {
    const textKey = key.replace("bg-", "text-");
    if (!COLOR_SWATCHES[textKey]) {
      COLOR_SWATCHES[textKey] = COLOR_SWATCHES[key];
    }
  }
}

const BORDER_WIDTH_PX: Record<string, number> = {
  'border': 1, 'border-0': 0, 'border-2': 2, 'border-4': 4, 'border-8': 8,
};

function getShapeSvgProps(styles: TailwindStyles | undefined) {
  if (!styles) return { stroke: 'none', strokeWidth: 0, fill: 'none', fillOpacity: 1 };

  const hasBorder = !!styles.borderWidth && styles.borderWidth !== 'border-0';
  const stroke = hasBorder && styles.borderColor ? tailwindToColor(styles.borderColor) || 'none' : 'none';

  const bwClass = styles.borderWidth || '';
  let strokeWidth = hasBorder ? (BORDER_WIDTH_PX[bwClass] ?? 1) : 0;
  // Handle arbitrary border width: border-[3px]
  const arbBw = bwClass.match(/^border-\[(\d+)px\]$/);
  if (arbBw) strokeWidth = parseInt(arbBw[1]);

  const bgColor = styles.backgroundColor || '';
  // Extract opacity suffix (e.g. bg-[#ff0000]/50 → 50)
  const opacityMatch = bgColor.match(/\/(\d+)$/);
  const fillOpacity = opacityMatch ? parseInt(opacityMatch[1]) / 100 : 1;
  const fill = bgColor ? tailwindToColor(bgColor) || 'none' : 'none';

  return { stroke, strokeWidth, fill, fillOpacity };
}

export function EditorCanvas() {
  const { state, elements, clearSelection, exitContainer, pageStyles, updatePageStyles, setViewMode, pages, activePageId, selectElement, toggleElementSelection, hoverElement, updateElement, wrapInContainer, ungroupContainer, deleteElement, deleteElements, duplicateElement, duplicateElementForDrag, pasteElement, pasteElements, toggleVisibility, toggleLock, isAdmin, editingElementId, pauseHistory, resumeHistory } = useYjsEditor();
  const { camera, cameraRef, worldRef, pageRef: cameraPageRef, canvasLayerRef, overlayWorldRef, overlayZoomRef, baseZoomRef, applyCamera } = useCamera();
  const isPreviewMode = state.viewMode === "preview";

  // Snapshot element trees into the module-level clipboard
  function snapshotToClipboard(ids: string[]) {
    const snaps: Record<string, Record<string, unknown>> = {};
    function snap(id: string) {
      const el = elements[id];
      if (!el || snaps[id]) return;
      snaps[id] = { ...el };
      if (el.children) {
        for (const childId of el.children) snap(childId);
      }
    }
    for (const id of ids) snap(id);
    elementClipboard.rootIds = ids;
    elementClipboard.snapshots = snaps;
  }
  const activePage = pages.find(p => p.id === activePageId);
  const isComponentPage = !!activePage?.component;
  const isLegacyPodcastPage = isComponentPage && activePage?.component === "PodcastPage";
  const isProviderPodcastPage = activePage?.provider === "podcast";
  const isPodcastPage = isLegacyPodcastPage || isProviderPodcastPage;
  const artboardX = pageStyles?.artboardX ?? 0;
  const artboardY = pageStyles?.artboardY ?? 0;
  const canvasRef = useRef<HTMLDivElement | null>(null);
  useAnimationTriggers(canvasRef, elements, isPreviewMode, pageStyles?.cssAnimations);
  const canvasDragRef = useRef<{
    elementId: string;
    startMouseX: number;
    startMouseY: number;
    startWorldX: number;
    startWorldY: number;
  } | null>(null);

  // ── Alt key tracking for duplicate cursor ──
  const [isAltHeld, setIsAltHeld] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.altKey) setIsAltHeld(true); };
    const up = (e: KeyboardEvent) => { if (!e.altKey) setIsAltHeld(false); };
    const blur = () => setIsAltHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // ── Per-page camera save/restore ──
  const savedCameraRef = useRef<Camera | null>(null);
  const cameraPerPageRef = useRef<Map<string, Camera>>(new Map());
  const prevPageIdRef = useRef(activePageId);

  // ── Panning state ──
  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const didPanRef = useRef(false);

  const hasInitializedRef = useRef(false);

  // Keep creation tool ref in sync for cursor restoration in event handlers
  const creationToolRef = useRef(state.creationTool);
  creationToolRef.current = state.creationTool;

  // Keep viewMode ref in sync for keydown handler
  const viewModeRef = useRef(state.viewMode);
  viewModeRef.current = state.viewMode;

  // ── Frame label drag (drag frame label = select artboard + move artboard) ──
  const labelDragRef = useRef<{ startMouseX: number; startMouseY: number; startArtboardX: number; startArtboardY: number } | null>(null);

  const handleLabelPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    selectElement(ARTBOARD_LAYER_ID);
    pauseHistory();
    labelDragRef.current = { startMouseX: e.clientX, startMouseY: e.clientY, startArtboardX: artboardX, startArtboardY: artboardY };
  }, [selectElement, artboardX, artboardY, pauseHistory]);

  const handleLabelPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = labelDragRef.current;
    if (!drag) return;
    const zoom = cameraRef.current.zoom;
    const dx = (e.clientX - drag.startMouseX) / zoom;
    const dy = (e.clientY - drag.startMouseY) / zoom;
    updatePageStyles({ artboardX: drag.startArtboardX + dx, artboardY: drag.startArtboardY + dy });
  }, [cameraRef, updatePageStyles]);

  const handleLabelPointerUp = useCallback((e: React.PointerEvent) => {
    if (!labelDragRef.current) return;
    labelDragRef.current = null;
    resumeHistory();
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  }, [resumeHistory]);

  // Native mousedown listener on label elements — must be native (not React)
  // because the marquee uses a native listener on the canvas container, and
  // React's synthetic stopPropagation fires too late (after native bubbling).
  const labelRefCallback = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    el.addEventListener("mousedown", (e) => e.stopPropagation());
  }, []);

  // ── Canvas element label drag (drag label = select + move canvas element) ──
  const elLabelDragRef = useRef<{ elementId: string; startMouseX: number; startMouseY: number; startWorldX: number; startWorldY: number } | null>(null);

  const handleElLabelPointerDown = useCallback((e: React.PointerEvent, elId: string, elX: number, elY: number) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    selectElement(elId);
    pauseHistory();
    elLabelDragRef.current = { elementId: elId, startMouseX: e.clientX, startMouseY: e.clientY, startWorldX: elX, startWorldY: elY };
  }, [selectElement, pauseHistory]);

  const handleElLabelPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = elLabelDragRef.current;
    if (!drag) return;
    const zoom = cameraRef.current.zoom;
    const dx = (e.clientX - drag.startMouseX) / zoom;
    const dy = (e.clientY - drag.startMouseY) / zoom;
    updateElement(drag.elementId, { x: Math.round(drag.startWorldX + dx), y: Math.round(drag.startWorldY + dy) });
  }, [cameraRef, updateElement]);

  const handleElLabelPointerUp = useCallback((e: React.PointerEvent) => {
    if (!elLabelDragRef.current) return;
    elLabelDragRef.current = null;
    resumeHistory();
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  }, [resumeHistory]);

  // ── Context menu ──
  const editorContextMenu = useContextMenu<CanvasContextMeta>();
  elementContextMenuRef.open = (x, y, id) =>
    editorContextMenu.open(x, y, { type: "element", elementId: id });
  elementContextMenuRef.openText = (x, y, id) =>
    editorContextMenu.open(x, y, { type: "text", elementId: id });

  // ── Cursor tracking (page-relative, throttled via rAF) ──
  const { updateCursor } = usePlayground();
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId = 0;
    let pendingX = 0;
    let pendingY = 0;
    let hasPending = false;

    const flush = () => {
      rafId = 0;
      if (hasPending) {
        updateCursor({ x: pendingX, y: pendingY });
        hasPending = false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Convert viewport-relative cursor to world coords via camera
      const canvasRect = canvas.getBoundingClientRect();
      const vpX = e.clientX - canvasRect.left;
      const vpY = e.clientY - canvasRect.top;
      const world = screenToWorld(vpX, vpY, cameraRef.current);
      pendingX = world.x;
      pendingY = world.y;
      hasPending = true;
      if (!rafId) rafId = requestAnimationFrame(flush);
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [updateCursor, cameraRef]);

  const deviceWidths: Record<string, number> = {
    desktop: 1440,
    tablet: 768,
    mobile: 375,
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (didPanRef.current) {
      didPanRef.current = false;
      return;
    }
    if (state.creationTool !== 'select') return;
    if (creationFlag.didCreate) {
      creationFlag.didCreate = false;
      return;
    }
    if (marqueeFlag.didMarquee) {
      marqueeFlag.didMarquee = false;
      return;
    }
    if (state.viewMode === "edit") {
      // If inside a focused container, exit one level
      if (state.focusedContainerId) {
        exitContainer();
      } else {
        // Click inside artboard → select artboard; outside → deselect all
        const pageEl = canvasRef.current?.querySelector('[data-page]');
        const isInsideArtboard = pageEl && pageEl.contains(e.target as Node);
        if (isInsideArtboard) {
          selectElement(ARTBOARD_LAYER_ID);
        } else {
          clearSelection();
        }
      }
    }
  };

  // Resolve a canvas element's dimension — supports auto/hug via tailwind class fallback
  function resolveCanvasDimension(
    value: number | undefined,
    twClass: string | undefined,
    fallback = 200
  ): number | string {
    if (value !== undefined) return value;
    if (twClass === "h-auto" || twClass === "w-auto") return "auto";
    if (twClass === "h-fit" || twClass === "w-fit") return "fit-content";
    return fallback;
  }

  // Derive all root-level element arrays in a single memo keyed on the stable `elements` ref.
  // Previously each .filter() created a new array every render, defeating the useMemo for sort.
  const { sortedArtboardElements, canvasElements, canvasContainers } = useMemo(() => {
    const root = Object.values(elements).filter(
      (el) => !el.parentId && el.type !== "sticker"
    );
    const artboard = root.filter(el => el.placement !== "canvas");
    const canvas = root.filter(el => el.placement === "canvas");
    return {
      sortedArtboardElements: artboard.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)),
      canvasElements: canvas,
      canvasContainers: canvas.filter(el => el.type === "container"),
    };
  }, [elements]);

  // Render canvas elements layer — shared between podcast and regular edit branches.
  // Extracted to avoid duplicating ~60 lines of identical pointer/drag handlers.
  const renderCanvasElements = () =>
    canvasElements.length > 0 ? (
      <div
        ref={canvasLayerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      >
        {canvasElements.map((el) => (
            <div
              key={el.id}
              data-canvas-wrapper={el.id}
              data-canvas-element
              style={{
                position: 'absolute',
                left: el.x,
                top: el.y,
                width: resolveCanvasDimension(el.width, el.tailwindStyles?.width),
                height: resolveCanvasDimension(el.height, el.tailwindStyles?.height),
                pointerEvents: 'auto',
                cursor: isAltHeld ? DUPLICATE_CURSOR : undefined,
              }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                // Shift+click: toggle multi-selection
                if (e.shiftKey) {
                  e.stopPropagation();
                  toggleElementSelection(el.id);
                  // Capture pointer so the subsequent click fires on this wrapper
                  // (whose onClick={stopPropagation} prevents handleCanvasClick)
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  return;
                }
                if (e.metaKey || e.ctrlKey) return;
                // Don't steal selection when a descendant is being text-edited
                if (editingElementId) return;
                e.stopPropagation();
                // If already selected, let the overlay (System B) handle the drag
                if (state.selectedIds.includes(el.id)) return;
                // Option+drag: leave a clone at the original position
                if (e.altKey) {
                  duplicateElementForDrag(el.id);
                }
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                selectElement(el.id);
                canvasDragFlag.didDrag = true;
                canvasDragRef.current = {
                  elementId: el.id,
                  startMouseX: e.clientX,
                  startMouseY: e.clientY,
                  startWorldX: el.x,
                  startWorldY: el.y,
                };
              }}
              onPointerMove={(e) => {
                const drag = canvasDragRef.current;
                if (!drag) return;
                const dx = (e.clientX - drag.startMouseX) / cameraRef.current.zoom;
                const dy = (e.clientY - drag.startMouseY) / cameraRef.current.zoom;
                const newX = Math.round(drag.startWorldX + dx);
                const newY = Math.round(drag.startWorldY + dy);
                updateElement(drag.elementId, { x: newX, y: newY });
              }}
              onPointerUp={() => {
                canvasDragRef.current = null;
                canvasDragFlag.didDrag = false;
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <RenderElement elementId={el.id} isPreview={false} />
            </div>
        ))}
      </div>
    ) : null;

  // Apply camera zoom to canvas layer when it first mounts.
  // applyCamera() writes zoom to canvasLayerRef, but only when the ref is non-null.
  // When the first canvas element is created, the canvas layer div mounts AFTER the
  // last applyCamera call, so it gets no zoom (defaults to 1). This effect ensures
  // the correct zoom is applied immediately on mount.
  useLayoutEffect(() => {
    if (canvasLayerRef.current) {
      const currentZoom = cameraRef.current.zoom;
      (canvasLayerRef.current.style as any).zoom = String(currentZoom);
      canvasLayerRef.current.style.transform = '';
    }
  }, [canvasElements.length, canvasLayerRef, cameraRef]);

  // Load font if specified in page styles
  useEffect(() => {
    if (pageStyles?.fontFamily) {
      loadGoogleFont(pageStyles.fontFamily);
    }
  }, [pageStyles?.fontFamily]);

  // Prevent browser zoom on Cmd/Ctrl+wheel everywhere in the editor
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    document.addEventListener("wheel", onWheel, { passive: false });
    return () => document.removeEventListener("wheel", onWheel);
  }, []);

  // Canvas-specific wheel: Ctrl+wheel → zoom to cursor, plain wheel → trackpad pan
  // In preview mode, allow native scroll (don't intercept wheel events)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (viewModeRef.current === "preview") return; // Let native scroll work
      if (e.ctrlKey || e.metaKey) {
        // Cmd/Ctrl+wheel / pinch-to-zoom
        e.preventDefault();
        e.stopPropagation();
        const dy = e.deltaMode === 1 ? e.deltaY * 8 : e.deltaY;
        const scaleFactor = Math.exp(-dy / 100);
        const cam = cameraRef.current;
        const rect = el.getBoundingClientRect();
        const vpX = e.clientX - rect.left;
        const vpY = e.clientY - rect.top;
        applyCamera(zoomAtPoint(cam, cam.zoom * scaleFactor, vpX, vpY), true);
      } else {
        // Two-finger trackpad pan
        e.preventDefault();
        const dx = e.deltaMode === 1 ? e.deltaX * 40 : e.deltaX;
        const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
        const cam = cameraRef.current;
        applyCamera({ ...cam, x: cam.x - dx, y: cam.y - dy }, true);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyCamera, cameraRef]);

  // ── Space key: hand tool (pan mode) ──
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && viewModeRef.current === "preview") {
        setViewMode("edit");
        return;
      }
      // ── Keyboard zoom (Cmd+= / Cmd+- / Shift+0) ──
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        const cam = cameraRef.current;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          applyCamera(zoomAtPoint(cam, cam.zoom + 0.1, rect.width / 2, rect.height / 2), true);
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        const cam = cameraRef.current;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          applyCamera(zoomAtPoint(cam, cam.zoom - 0.1, rect.width / 2, rect.height / 2), true);
        }
        return;
      }
      if (e.shiftKey && e.key === '0') {
        e.preventDefault();
        const cam = cameraRef.current;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          applyCamera(zoomAtPoint(cam, 1.0, rect.width / 2, rect.height / 2), true);
        }
        return;
      }
      if (e.code === "Space") {
        const target = e.target as HTMLElement;
        const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
        const isInPanel = !!target.closest?.("[data-editor-panel]");
        if (isTyping || isInPanel) return;
        // Prevent default on ALL Space events (including auto-repeat) to block browser scroll-down
        e.preventDefault();
        if (!e.repeat) {
          isPanningRef.current = true;
          setIsPanning(true);
          if (canvasRef.current) canvasRef.current.style.cursor = "grab";
        }
      }
    };
    const handleKeyUp = (e: globalThis.KeyboardEvent) => {
      if (e.code === "Space") {
        isPanningRef.current = false;
        setIsPanning(false);
        if (canvasRef.current) {
          // If actively dragging, keep grabbing cursor; otherwise restore based on creation tool
          const defaultCursor = creationToolRef.current !== 'select' ? 'crosshair' : CUSTOM_CURSOR;
          canvasRef.current.style.cursor = panStartRef.current ? "grabbing" : defaultCursor;
        }
      }
    };
    const handleBlur = () => {
      isPanningRef.current = false;
      setIsPanning(false);
      if (panStartRef.current) {
        panStartRef.current = null;
      }
      if (canvasRef.current) {
        canvasRef.current.style.cursor = creationToolRef.current !== 'select' ? 'crosshair' : CUSTOM_CURSOR;
        canvasRef.current.style.userSelect = "";
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // ── Mouse handlers: drag-to-pan ──
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const handleMouseDown = (e: MouseEvent) => {
      // Space+left-click or middle mouse button
      if ((isPanningRef.current && e.button === 0) || e.button === 1) {
        e.preventDefault();
        panStartRef.current = { x: e.clientX, y: e.clientY };
        didPanRef.current = false;
        el.style.cursor = "grabbing";
        el.style.userSelect = "none";
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!panStartRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;

      // Drag threshold: 3px before counting as a pan
      if (!didPanRef.current && Math.abs(dx) + Math.abs(dy) > 3) {
        didPanRef.current = true;
      }

      // Camera x/y are screen-space pixels — no zoom compensation needed
      const cam = cameraRef.current;
      applyCamera({ ...cam, x: cam.x + dx, y: cam.y + dy });
      panStartRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      if (panStartRef.current) {
        panStartRef.current = null;
        const defaultCursor = creationToolRef.current !== 'select' ? 'crosshair' : CUSTOM_CURSOR;
        el.style.cursor = isPanningRef.current ? "grab" : defaultCursor;
        el.style.userSelect = "";
      }
    };

    el.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      el.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Convert page styles through Tailwind pipeline (unified with element rendering)
  const pageTw = pageStylesToTailwind(pageStyles ?? defaultPageStyles);
  const { appearance: outerTw, layout: innerTw } = splitPageTailwind(pageTw);
  const outerClasses = getStyleClasses(outerTw as TailwindStyles);
  const { filteredClasses: outerFiltered, inlineStyles: outerInline } =
    extractArbitraryStyles(outerClasses, outerTw.gradientStops as string | undefined, undefined, undefined, outerTw.backgroundFills as string | undefined);
  const innerClasses = getStyleClasses(innerTw as TailwindStyles);
  const { filteredClasses: innerFiltered, inlineStyles: innerInline } =
    extractArbitraryStyles(innerClasses);

  const pageWidth = deviceWidths[state.device];

  // Page-level shader overlay (rendered behind children like a fill)
  const pageShaderOverlay = pageStyles?.shaderLayers ? (
    <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
      <ElementShaderLayers
        shaderLayersJson={pageStyles.shaderLayers}
        elementId={ARTBOARD_LAYER_ID}
      />
    </div>
  ) : null;

  // ── Initial camera position (before first paint) ──
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cam = cameraToFitRect(
      { x: artboardX, y: artboardY, width: pageWidth, height: 900 },
      rect.width, rect.height, 40
    );
    applyCamera(cam, true);
  }, []);

  // Re-center when device changes
  const prevPageWidthRef = useRef(pageWidth);
  useEffect(() => {
    if (isPreviewMode) return;
    if (prevPageWidthRef.current === pageWidth) return;
    prevPageWidthRef.current = pageWidth;
    const canvas = canvasRef.current;
    const page = cameraPageRef.current;
    if (!canvas || !page) return;
    const canvasRect = canvas.getBoundingClientRect();
    const cam = cameraToFitRect(
      { x: artboardX, y: artboardY, width: pageWidth, height: page.offsetHeight || 900 },
      canvasRect.width, canvasRect.height, 40
    );
    applyCamera(cam, true);
  }, [pageWidth, applyCamera, isPreviewMode]);

  // Re-center when elements first load (Liveblocks async)
  const elementCount = Object.keys(elements).length;
  useEffect(() => {
    if (isPreviewMode) return;
    if (hasInitializedRef.current || elementCount === 0) return;
    hasInitializedRef.current = true;
    // Wait one frame for layout to settle
    requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      const page = cameraPageRef.current;
      if (!canvas || !page) return;
      const canvasRect = canvas.getBoundingClientRect();
      const cam = cameraToFitRect(
        { x: artboardX, y: artboardY, width: pageWidth, height: page.offsetHeight || 900 },
        canvasRect.width, canvasRect.height, 40
      );
      applyCamera(cam, true);
    });
  }, [elementCount, pageWidth, applyCamera, isPreviewMode]);

  // ── Per-page camera: save/restore on page switch ──
  useEffect(() => {
    if (prevPageIdRef.current === activePageId) return;
    const oldPageId = prevPageIdRef.current;
    prevPageIdRef.current = activePageId;

    // In preview mode, don't apply camera transforms — clear any stale
    // transform on the world div so pages render at natural position.
    if (isPreviewMode) {
      if (worldRef.current) worldRef.current.style.transform = 'none';
      return;
    }

    // Save current camera for the old page
    cameraPerPageRef.current.set(oldPageId, cameraRef.current);

    // Reset baseZoomRef so next applyCamera applies CSS zoom directly
    baseZoomRef.current = 0;

    // Restore saved camera for new page, or fit-to-screen
    const savedCam = cameraPerPageRef.current.get(activePageId);
    if (savedCam) {
      applyCamera(savedCam, true);
    } else {
      const canvas = canvasRef.current;
      const page = cameraPageRef.current;
      if (canvas && page) {
        const canvasRect = canvas.getBoundingClientRect();
        const cam = cameraToFitRect(
          { x: artboardX, y: artboardY, width: pageWidth, height: page.offsetHeight || 900 },
          canvasRect.width, canvasRect.height, 40
        );
        applyCamera(cam, true);
      }
    }
  }, [activePageId, pageWidth, applyCamera, cameraRef, baseZoomRef, cameraPageRef, canvasLayerRef, isPreviewMode, worldRef]);

  // ── Save/restore camera on preview mode switch ──
  // useLayoutEffect so transforms are cleared before the browser paints.
  useLayoutEffect(() => {
    if (isPreviewMode) {
      savedCameraRef.current = cameraRef.current;
      if (isPodcastPage) {
        // PodcastPage: clear transforms directly (not via applyCamera) because
        // applyCamera sets translate(0px,0px) which still creates a CSS
        // containing block — we want transform:none for fixed descendants.
        if (worldRef.current) {
          worldRef.current.style.transform = 'none';
        }
        if (cameraPageRef.current) {
          (cameraPageRef.current.style as any).zoom = '1';
          cameraPageRef.current.style.transform = '';
        }
        if (canvasLayerRef.current) {
          (canvasLayerRef.current.style as any).zoom = '1';
          canvasLayerRef.current.style.transform = '';
        }
      }
      // Regular pages: edit DOM unmounts in preview, no DOM cleanup needed
    } else if (savedCameraRef.current) {
      // Exiting preview: reset scroll position left over from preview's overflow-auto
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.scrollTop = 0;
        canvas.scrollLeft = 0;
      }
      // Restore camera (re-applies to freshly mounted refs)
      baseZoomRef.current = 0; // force CSS zoom on next applyCamera
      applyCamera(savedCameraRef.current, true);
      savedCameraRef.current = null;
    }
  }, [isPreviewMode, isPodcastPage, applyCamera, cameraRef, baseZoomRef, worldRef, cameraPageRef, canvasLayerRef]);

  // Label zoom — cameraRef is synchronously updated in applyCamera, used for
  // canvas element label positions (artboard labels don't need zoom).

  return (
    <TooltipProvider delayDuration={400}>
    <div
      ref={canvasRef}
      data-canvas
      data-preview-mode={isPreviewMode ? "" : undefined}
      className={cn(
        "flex-1 relative",
        isPreviewMode ? "bg-transparent overflow-auto overscroll-none" : "bg-stone-100 dark:bg-stone-900 overflow-hidden",
      )}
      onClick={handleCanvasClick}
      onContextMenu={(e) => {
        if (isPreviewMode || state.creationTool !== "select") return;
        e.preventDefault();
        editorContextMenu.open(e.clientX, e.clientY, { type: "canvas" });
      }}
      style={{ cursor: !isPreviewMode ? (state.creationTool !== 'select' ? 'crosshair' : CUSTOM_CURSOR) : undefined }}
    >
      <AnimationStyles elements={elements} pageCssAnimations={pageStyles?.cssAnimations} />
      {isPodcastPage ? (
        /* PodcastPage: unified container — stays mounted across edit ↔ preview */
        <>
          <div
            ref={worldRef}
            style={isPreviewMode ? undefined : { willChange: 'transform' }}
          >
            <div
              ref={cameraPageRef}
              data-page
              data-element-id={isPreviewMode ? undefined : ARTBOARD_LAYER_ID}
              className={cn(
                isPreviewMode ? "min-h-screen flex flex-col" : "overflow-hidden relative flex flex-col",
                !pageStyles?.backgroundColor && !isLegacyPodcastPage && "bg-background",
                isProviderPodcastPage ? outerFiltered : undefined,
              )}
              style={{
                ...(isLegacyPodcastPage ? { background: "linear-gradient(180deg, #F0F2F5 0%, #FFFFFF 100%)" } : {}),
                ...(isProviderPodcastPage ? outerInline : {}),
                ...(isPreviewMode ? {} : {
                  position: 'absolute' as const,
                  left: artboardX,
                  top: artboardY,
                  width: pageWidth,
                  minHeight: 900,
                  pointerEvents: isPanning ? "none" : undefined,
                  cursor: isAltHeld ? DUPLICATE_CURSOR : undefined,
                }),
              }}
              onMouseMove={isPreviewMode ? undefined : (e) => {
                if (e.target === e.currentTarget) {
                  hoverElement(ARTBOARD_LAYER_ID);
                }
              }}
              onMouseLeave={isPreviewMode ? undefined : () => {
                hoverElement(null);
              }}
              onClick={isPreviewMode ? undefined : (e) => {
                if (e.target === e.currentTarget) {
                  e.stopPropagation();
                  selectElement(ARTBOARD_LAYER_ID);
                }
              }}
            >
              {pageShaderOverlay}
              <ArtboardWidthProvider value={isPreviewMode ? null : pageWidth}>
                {isProviderPodcastPage ? (
                  <PodcastProvider isEditMode={!isPreviewMode}>
                    <div style={{ width: '100%', containerType: 'inline-size' }}>
                      <div
                        className={cn("flex-1", innerFiltered)}
                        style={{ ...innerInline, gap: innerInline.gap ?? "1rem" }}
                      >
                        {sortedArtboardElements.map((el) => (
                            <RenderElement key={el.id} elementId={el.id} isPreview={isPreviewMode} />
                          ))}
                      </div>
                    </div>
                  </PodcastProvider>
                ) : (
                  <PodcastPageContent contained={!isPreviewMode} />
                )}
              </ArtboardWidthProvider>
            </div>

            {/* Canvas layer — only in edit mode */}
            {!isPreviewMode && renderCanvasElements()}
          </div>

          {/* Overlays + labels — inside overlay zoom pipeline for lag-free pan & zoom */}
          {!isPreviewMode && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <div ref={overlayWorldRef} style={{ position: 'absolute', inset: 0, willChange: 'transform' }}>
                <div ref={overlayZoomRef} style={{ position: 'absolute', inset: 0 }}>
                  {/* Frame labels — world-space anchor, CSS zoom counter-scale (layout-phase, no jitter) */}
                  <div
                    ref={labelRefCallback}
                    style={{ position: 'absolute', left: artboardX, top: artboardY, width: 0, height: 0, overflow: 'visible', zIndex: 50 }}
                  >
                    <div
                      onPointerDown={handleLabelPointerDown}
                      onPointerMove={handleLabelPointerMove}
                      onPointerUp={handleLabelPointerUp}
                      onClick={(e) => e.stopPropagation()}
                      style={{ position: 'absolute', bottom: 0, left: 0, zoom: 'var(--inv-zoom, 1)', padding: '2px 0', cursor: 'inherit', pointerEvents: 'auto', whiteSpace: 'nowrap' } as React.CSSProperties}
                    >
                      <span
                        className="text-[11px] leading-4 text-stone-500 dark:text-stone-400 select-none"
                        style={state.selectedIds.includes(ARTBOARD_LAYER_ID) ? { color: '#3b82f6' } : undefined}
                      >
                        {activePage?.artboardName || "Frame"}
                      </span>
                    </div>
                  </div>
                  {canvasContainers.map((el) => (
                    <div
                      key={`label-${el.id}`}
                      ref={labelRefCallback}
                      style={{ position: 'absolute', left: el.x, top: el.y, width: 0, height: 0, overflow: 'visible', zIndex: 50 }}
                    >
                      <div
                        onPointerDown={(e) => handleElLabelPointerDown(e, el.id, el.x, el.y)}
                        onPointerMove={handleElLabelPointerMove}
                        onPointerUp={handleElLabelPointerUp}
                        onClick={(e) => e.stopPropagation()}
                        style={{ position: 'absolute', bottom: 0, left: 0, zoom: 'var(--inv-zoom, 1)', padding: '2px 0', cursor: 'inherit', pointerEvents: 'auto', whiteSpace: 'nowrap' } as React.CSSProperties}
                      >
                        <span
                          className="text-[11px] leading-4 text-stone-500 dark:text-stone-400 select-none"
                          style={state.selectedIds.includes(el.id) ? { color: '#3b82f6' } : undefined}
                        >
                          {el.name || el.content?.slice(0, 20) || el.type}
                        </span>
                      </div>
                    </div>
                  ))}
                  <CursorLayer />
                  <MarqueeOverlay canvasRef={canvasRef} isPanningRef={isPanningRef} />
                  <SelectionOverlay canvasRef={canvasRef} />
                </div>
              </div>
            </div>
          )}
        </>
      ) : isPreviewMode ? (
        /* Regular page preview */
        <div
          data-page
          data-element-id={ARTBOARD_LAYER_ID}
          className={cn(
            "min-h-screen flex flex-col",
            !pageStyles?.backgroundColor && "bg-background",
            outerFiltered,
          )}
          style={{
            ...(pageStyles?.fontFamily
              ? { fontFamily: `'${pageStyles.fontFamily}', sans-serif` }
              : {}),
            ...outerInline,
          }}
        >
          {pageShaderOverlay}
          <div
            className={cn("flex-1", innerFiltered)}
            style={{ ...innerInline, gap: innerInline.gap ?? "1rem" }}
          >
            {sortedArtboardElements.length > 0
              ? sortedArtboardElements.map((el) => (
                    <RenderElement key={el.id} elementId={el.id} isPreview />
                  ))
              : null}
          </div>
        </div>
      ) : (
        /* Regular page edit */
        <>
          <div
            ref={worldRef}
            style={{ willChange: 'transform' }}
          >
            <div
              ref={cameraPageRef}
              data-page
              data-element-id={ARTBOARD_LAYER_ID}
              className={cn(
                "overflow-hidden min-h-[400px] flex flex-col",
                !pageStyles?.backgroundColor && "bg-background",
                outerFiltered,
              )}
              style={{
                position: 'absolute',
                left: artboardX,
                top: artboardY,
                width: pageWidth,
                minHeight: 900,
                pointerEvents: isPanning ? "none" : undefined,
                cursor: isAltHeld ? DUPLICATE_CURSOR : undefined,
                ...(pageStyles?.fontFamily
                  ? { fontFamily: `'${pageStyles.fontFamily}', sans-serif` }
                  : {}),
                ...outerInline,
              }}
              onMouseMove={(e) => {
                if (e.target === e.currentTarget) {
                  hoverElement(ARTBOARD_LAYER_ID);
                }
              }}
              onMouseLeave={() => {
                hoverElement(null);
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  e.stopPropagation();
                  selectElement(ARTBOARD_LAYER_ID);
                }
              }}
            >
              {pageShaderOverlay}
              <div
                className={cn("flex-1", innerFiltered)}
                style={{ ...innerInline, gap: innerInline.gap ?? "1rem" }}
              >
                {sortedArtboardElements.length > 0 ? (
                  sortedArtboardElements.map((el) => (
                      <RenderElement key={el.id} elementId={el.id} isPreview={false} />
                    ))
                ) : null}
              </div>
            </div>

            {/* Canvas layer — same zoom as artboard, absolute positioning for infinite canvas elements */}
            {renderCanvasElements()}
          </div>
          {/* Overlays + labels — inside overlay zoom pipeline for lag-free pan & zoom */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div ref={overlayWorldRef} style={{ position: 'absolute', inset: 0, willChange: 'transform' }}>
              <div ref={overlayZoomRef} style={{ position: 'absolute', inset: 0 }}>
                {/* Frame labels — world-space anchor, CSS zoom counter-scale (layout-phase, no jitter) */}
                <div
                  ref={labelRefCallback}
                  style={{ position: 'absolute', left: artboardX, top: artboardY, width: 0, height: 0, overflow: 'visible', zIndex: 50 }}
                >
                  <div
                    onPointerDown={handleLabelPointerDown}
                    onPointerMove={handleLabelPointerMove}
                    onPointerUp={handleLabelPointerUp}
                    onClick={(e) => e.stopPropagation()}
                    style={{ position: 'absolute', bottom: 0, left: 0, zoom: 'var(--inv-zoom, 1)', padding: '2px 0', cursor: 'inherit', pointerEvents: 'auto', whiteSpace: 'nowrap' } as React.CSSProperties}
                  >
                    <span
                      className="text-[11px] leading-4 text-stone-500 dark:text-stone-400 select-none"
                      style={state.selectedIds.includes(ARTBOARD_LAYER_ID) ? { color: '#3b82f6' } : undefined}
                    >
                      {activePage?.artboardName || "Frame"}
                    </span>
                  </div>
                </div>
                {canvasContainers.map((el) => (
                  <div
                    key={`label-${el.id}`}
                    ref={labelRefCallback}
                    style={{ position: 'absolute', left: el.x, top: el.y, width: 0, height: 0, overflow: 'visible', zIndex: 50 }}
                  >
                    <div
                      onPointerDown={(e) => handleElLabelPointerDown(e, el.id, el.x, el.y)}
                      onPointerMove={handleElLabelPointerMove}
                      onPointerUp={handleElLabelPointerUp}
                      onClick={(e) => e.stopPropagation()}
                      style={{ position: 'absolute', bottom: 0, left: 0, zoom: 'var(--inv-zoom, 1)', padding: '2px 0', cursor: 'inherit', pointerEvents: 'auto', whiteSpace: 'nowrap' } as React.CSSProperties}
                    >
                      <span
                        className="text-[11px] leading-4 text-stone-500 dark:text-stone-400 select-none"
                        style={state.selectedIds.includes(el.id) ? { color: '#3b82f6' } : undefined}
                      >
                        {el.name || el.content?.slice(0, 20) || el.type}
                      </span>
                    </div>
                  </div>
                ))}
                <MarqueeOverlay canvasRef={canvasRef} isPanningRef={isPanningRef} />
                <SelectionOverlay canvasRef={canvasRef} />
              </div>
            </div>
          </div>
        </>
      )}
      <EffectLayer
        elements={elements}
        isPreviewMode={isPreviewMode}
        scrollContainerRef={canvasRef}
        zoomScale={cameraRef.current.zoom}
      />
      <EffectLayerRenderer
        elements={elements}
        isPreviewMode={isPreviewMode}
        scrollContainerRef={canvasRef}
        zoomScale={cameraRef.current.zoom}
        pageEffectLayers={pageStyles?.effectLayers}
      />
      {isPreviewMode && (
        <button
          onClick={() => setViewMode("edit")}
          className="fixed bottom-3 right-3 z-50 rounded-[5px] px-3 py-2 text-[11px] font-medium leading-4 tracking-[0.055px] text-white transition-colors"
          style={{ fontFamily: "'Inter', sans-serif", backgroundColor: 'rgb(12, 10, 9)' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgb(41, 37, 36)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgb(12, 10, 9)'; }}
        >
          Exit Preview
        </button>
      )}
      {editorContextMenu.state.isOpen && editorContextMenu.state.meta && (() => {
        const meta = editorContextMenu.state.meta;
        let items: ContextMenuItemDef[];
        let menuWidth: number;

        if (meta.type === "canvas") {
          menuWidth = 160;
          items = [
            {
              label: "Paste",
              shortcut: "\u2318V",
              disabled: elementClipboard.rootIds.length === 0,
              onClick: () => {
                if (elementClipboard.rootIds.length > 0) {
                  pasteElements([...elementClipboard.rootIds]);
                }
              },
            },
            { type: "separator" },
            {
              label: "Zoom to 100%",
              shortcut: "\u21E70",
              onClick: () => {
                const rect = canvasRef.current?.getBoundingClientRect();
                if (rect) {
                  applyCamera(zoomAtPoint(cameraRef.current, 1.0, rect.width / 2, rect.height / 2), true);
                }
              },
            },
            {
              label: "Zoom to fit",
              shortcut: "\u21E71",
              onClick: () => {
                const canvas = canvasRef.current;
                if (canvas) {
                  const canvasRect = canvas.getBoundingClientRect();
                  const pageEl = canvas.querySelector("[data-page]") as HTMLElement | null;
                  const pageWidth = pageEl?.offsetWidth || 375;
                  const pageHeight = pageEl?.offsetHeight || 812;
                  applyCamera(
                    cameraToFitRect({ x: artboardX, y: artboardY, width: pageWidth, height: pageHeight }, canvasRect.width, canvasRect.height, 40),
                    true
                  );
                }
              },
            },
            { type: "separator" },
            { label: "Cursor Chat", shortcut: "/", onClick: () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true })); } },
            { label: "Reactions", shortcut: "E", onClick: () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "e", bubbles: true })); } },
          ];
        } else if (meta.type === "text") {
          menuWidth = 200;
          items = [
            {
              label: "Copy",
              shortcut: "\u2318C",
              onClick: () => {
                const sel = window.getSelection();
                if (sel && sel.toString()) {
                  navigator.clipboard.writeText(sel.toString());
                }
              },
            },
            {
              label: "Paste",
              shortcut: "\u2318V",
              onClick: async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  document.execCommand("insertText", false, text);
                } catch { /* clipboard permission denied */ }
              },
            },
            {
              label: "Paste and match style",
              shortcut: "\u21E7\u2318V",
              onClick: async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  document.execCommand("insertText", false, text);
                } catch { /* clipboard permission denied */ }
              },
            },
          ];
        } else {
          menuWidth = 160;
          const el = elements[meta.elementId];
          const hasProtectedDescendant = (id: string): boolean => {
            const e = elements[id];
            if (!e) return false;
            if (e.isCore) return true;
            return e.children?.some(hasProtectedDescendant) ?? false;
          };
          const isProtected = !isAdmin && hasProtectedDescendant(meta.elementId);
          const isLocked = el?.locked;
          items = [
            { label: "Cut", shortcut: "\u2318X", onClick: () => { snapshotToClipboard([meta.elementId]); deleteElement(meta.elementId); } },
            { label: "Copy", shortcut: "\u2318C", onClick: () => { snapshotToClipboard([meta.elementId]); } },
            { label: "Duplicate", shortcut: "\u2318D", disabled: el?.type === "component", onClick: () => duplicateElement(meta.elementId) },
            { type: "separator" },
            {
              label: "Frame Selection",
              shortcut: "\u2318G",
              onClick: () => wrapInContainer([meta.elementId]),
            },
            ...(el?.type === "container" && el?.children?.length ? [{
              label: "Ungroup",
              shortcut: "\u21E7\u2318G",
              onClick: () => ungroupContainer(meta.elementId),
            }] : []),
            { type: "separator" },
            {
              label: el?.hidden ? "Show" : "Hide",
              shortcut: "\u21E7\u2318H",
              onClick: () => toggleVisibility(meta.elementId),
            },
            {
              label: isLocked ? "Unlock" : "Lock",
              shortcut: "\u21E7\u2318L",
              onClick: () => toggleLock(meta.elementId),
            },
            { type: "separator" },
            {
              label: "Delete",
              shortcut: "\u232B",
              disabled: !!isProtected || !!isLocked,
              onClick: () => deleteElement(meta.elementId),
            },
          ];
        }

        return (
          <ContextMenu
            ref={editorContextMenu.menuRef}
            items={items}
            position={editorContextMenu.state.position}
            width={menuWidth}
            onClose={editorContextMenu.close}
          />
        );
      })()}
    </div>
    </TooltipProvider>
  );
}

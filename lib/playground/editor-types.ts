// Editor Types for V0-style UI
// Adapted from v0 editor with Yjs compatibility

import type { SpringConfig } from "./spring-solver";

// ─── Interaction Types ────────────────────────────────────────────────────────

export type InteractionTransition = {
  property: string;   // "all" | "opacity, scale, box-shadow"
  duration: number;    // ms (75-1000)
  easing: string;      // "ease-in-out" | "cubic-bezier(0.4, 0, 0.2, 1)" | "linear(...)"
  delay?: number;      // ms
  springConfig?: SpringConfig;   // when present, easing is computed linear()
  springPresetId?: string;       // preset ID for dropdown display
};

// CSS property names in kebab-case, values as CSS strings
export type CSSPropertyMap = Record<string, string>;

export type InteractionState = {
  transition?: InteractionTransition;  // legacy/fallback
  hoverTransition?: InteractionTransition;
  focusTransition?: InteractionTransition;
  activeTransition?: InteractionTransition;
  hover?: CSSPropertyMap;   // { "scale": "1.05", "box-shadow": "0 10px 15px rgba(0,0,0,0.1)" }
  focus?: CSSPropertyMap;
  active?: CSSPropertyMap;
};

export function parseInteractions(json?: string | null): InteractionState | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as InteractionState;
  } catch {
    return null;
  }
}

export function serializeInteractions(state: InteractionState): string {
  return JSON.stringify(state);
}

// ─── Animation Types ─────────────────────────────────────────────────────────

export type AnimationTrigger = "load" | "scroll-in" | "hover" | "focus" | "active";

export type KeyframeStop = { offset: number; properties: CSSPropertyMap };

export type AnimationState = {
  name: string;                 // AI-generated label, e.g. "Fade In", "Slide Up"
  trigger: AnimationTrigger;
  from: CSSPropertyMap;
  to: CSSPropertyMap;
  duration: number;             // 100-5000ms
  delay: number;                // 0-10000ms
  easing: string;               // "ease-out" | "cubic-bezier(...)"
  fillMode: "forwards" | "both";
  iterationCount?: number | "infinite";  // defaults to 1
  direction?: "normal" | "reverse" | "alternate" | "alternate-reverse";  // defaults to "normal"
  keyframes?: KeyframeStop[];  // when present, overrides from/to in the compiler
};

export function parseAnimations(json?: string | null): AnimationState | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as AnimationState;
  } catch {
    return null;
  }
}

export function serializeAnimations(state: AnimationState): string {
  return JSON.stringify(state);
}

// ─── Animation Map (multi-animation per element) ────────────────────────────

/** One animation per trigger type — trigger-keyed map */
export type AnimationMap = Partial<Record<AnimationTrigger, AnimationState>>;

/**
 * Parse the JSON-serialized animations field into a trigger-keyed map.
 * Auto-migrates: old single AnimationState → wrapped in map.
 */
export function parseAnimationMap(json?: string | null): AnimationMap | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    // Auto-migrate: old single AnimationState → wrap in map
    if ("trigger" in parsed && "from" in parsed && "to" in parsed) {
      return { [parsed.trigger as AnimationTrigger]: parsed as AnimationState };
    }
    // Already a map
    return parsed as AnimationMap;
  } catch {
    return null;
  }
}

export function serializeAnimationMap(map: AnimationMap): string {
  return JSON.stringify(map);
}

// ─── React Effect Types ─────────────────────────────────────────────────────

export type EffectPropType = "number" | "color" | "boolean" | "select" | "string";

export type EffectPropSchema = {
  key: string;
  type: EffectPropType;
  label: string;
  default: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: { value: string; label: string }[];
};

export type EffectTrigger = "always" | "hover" | "click" | "load";
export type EffectPlacement = "overlay" | "content";

export type EffectType = "css" | "react";

export type ReactEffectState = {
  type?: EffectType;  // "css" = pure CSS injected on element, "react" = React component overlay. Defaults to "react".
  name: string;
  code: string;       // type="react": React component code. type="css": CSS template with {{propKey}} placeholders.
  signature: string;
  propsSchema: EffectPropSchema[];
  props: Record<string, string | number | boolean>;
  trigger: EffectTrigger;
  placement: EffectPlacement;
  preset?: string;    // Built-in preset ID (e.g. "text-scramble", "typewriter"). When set, code/signature are empty.
};

export function parseReactEffect(json?: string | null): ReactEffectState | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as ReactEffectState;
  } catch {
    return null;
  }
}

export function serializeReactEffect(state: ReactEffectState): string {
  return JSON.stringify(state);
}

// ─── Unified CSS Animation Types ─────────────────────────────────────────────

/** All supported animation trigger types across the unified system */
export type UnifiedAnimationTrigger = "hover" | "focus" | "active" | "load" | "scroll-in";

/** Transition animation — pseudo-class property changes (replaces InteractionState groups) */
export type TransitionAnimation = {
  kind: "transition";
  id: string;
  name: string;
  trigger: "hover" | "focus" | "active";
  properties: CSSPropertyMap;
  transition: InteractionTransition;
  enabled?: boolean;
};

/** Keyframe animation — @keyframes animations (replaces AnimationState) */
export type KeyframeAnimation = {
  kind: "keyframe";
  id: string;
  name: string;
  trigger: UnifiedAnimationTrigger;
  from: CSSPropertyMap;
  to: CSSPropertyMap;
  keyframes?: KeyframeStop[];
  duration: number;
  delay: number;
  easing: string;
  springConfig?: SpringConfig;   // when present, easing is computed linear()
  springPresetId?: string;       // preset ID for dropdown display
  fillMode: "forwards" | "both";
  iterationCount?: number | "infinite";
  /** Preserved repeat count when Loop is toggled on */
  _lastIterationCount?: number;
  direction?: "normal" | "reverse" | "alternate" | "alternate-reverse";
  enabled?: boolean;
};

/** CSS template animation — raw CSS with {{propKey}} placeholders (replaces CSS-type ReactEffectState) */
export type CSSTemplateAnimation = {
  kind: "css-template";
  id: string;
  name: string;
  trigger: UnifiedAnimationTrigger;
  code: string;
  signature: string;
  propsSchema: EffectPropSchema[];
  props: Record<string, string | number | boolean>;
  enabled?: boolean;
};

/** Spring-physics animation — compiles to CSS @keyframes with linear() easing */
export type SpringAnimation = {
  kind: "spring";
  id: string;
  name: string;
  trigger: UnifiedAnimationTrigger;
  springConfig: SpringConfig;
  presetId?: string;
  properties: {
    [cssProperty: string]: { from: string; to: string };
  };
  fillMode: "forwards" | "both";
  enabled?: boolean;
};

/** Discriminated union of all CSS animation types */
export type CSSAnimation = TransitionAnimation | KeyframeAnimation | CSSTemplateAnimation | SpringAnimation;

/** Array of CSS animations stored on an element */
export type CSSAnimationList = CSSAnimation[];

// ─── Unified Parse/Serialize ─────────────────────────────────────────────────

/**
 * Parse the unified cssAnimations field, with automatic migration from old fields.
 * Priority: cssAnimations > merge(interactions + animations + css-type reactEffect)
 */
export function parseCSSAnimations(
  element: {
    cssAnimations?: string | null;
    interactions?: string | null;
    animations?: string | null;
    reactEffect?: string | null;
  }
): CSSAnimationList {
  // 1. If unified field exists, use it directly
  if (element.cssAnimations) {
    try {
      const parsed = JSON.parse(element.cssAnimations);
      if (Array.isArray(parsed)) return parsed as CSSAnimationList;
    } catch {
      // fall through to migration
    }
  }

  // 2. Migrate from old fields
  const result: CSSAnimationList = [];
  let idCounter = 0;
  const nextId = () => `migrated-${idCounter++}`;

  // 2a. Migrate interactions → TransitionAnimation entries
  const interactions = parseInteractions(element.interactions);
  if (interactions) {
    const pseudoClasses = ["hover", "focus", "active"] as const;
    for (const pc of pseudoClasses) {
      const props = interactions[pc];
      if (!props || Object.keys(props).length === 0) continue;

      const transitionKey = `${pc}Transition` as const;
      const transition = interactions[transitionKey] ?? interactions.transition ?? {
        property: "all",
        duration: 200,
        easing: "ease-in-out",
      };

      result.push({
        kind: "transition",
        id: nextId(),
        name: `${pc.charAt(0).toUpperCase() + pc.slice(1)} Effect`,
        trigger: pc,
        properties: { ...props },
        transition: { ...transition },
      });
    }
  }

  // 2b. Migrate animations → KeyframeAnimation entries
  const animMap = parseAnimationMap(element.animations);
  if (animMap) {
    for (const [trigger, anim] of Object.entries(animMap)) {
      if (!anim) continue;
      result.push({
        kind: "keyframe",
        id: nextId(),
        name: anim.name || "Animation",
        trigger: trigger as UnifiedAnimationTrigger,
        from: { ...anim.from },
        to: { ...anim.to },
        keyframes: anim.keyframes ? anim.keyframes.map(k => ({ ...k, properties: { ...k.properties } })) : undefined,
        duration: anim.duration,
        delay: anim.delay,
        easing: anim.easing,
        fillMode: anim.fillMode,
        iterationCount: anim.iterationCount,
        direction: anim.direction,
      });
    }
  }

  // 2c. Migrate CSS-type reactEffect → CSSTemplateAnimation
  const effect = parseReactEffect(element.reactEffect);
  if (effect && effect.type === "css") {
    result.push({
      kind: "css-template",
      id: nextId(),
      name: effect.name || "CSS Effect",
      trigger: effect.trigger as UnifiedAnimationTrigger,
      code: effect.code,
      signature: effect.signature,
      propsSchema: [...effect.propsSchema],
      props: { ...effect.props },
    });
  }

  return result;
}

export function serializeCSSAnimations(list: CSSAnimationList): string {
  return JSON.stringify(list);
}

// ─── Responsive Styles ────────────────────────────────────────────────────────

// Responsive styles for different breakpoints
// NOTE: Must be `type` (not `interface`) for Liveblocks LSON compatibility.
export type ResponsiveStyles = {
  base: TailwindStyles;      // Desktop (default)
  tablet?: TailwindStyles;   // md breakpoint overrides
  mobile?: TailwindStyles;   // sm breakpoint overrides
};

// Extended element type to include v0 types
export type EditorElementType =
  | 'heading'
  | 'text'
  | 'image'
  | 'button'
  | 'container'
  | 'divider'
  | 'badge'
  | 'sticker'
  | 'link'
  | 'rectangle'
  | 'circle'
  | 'star'
  | 'video'
  | 'gif'
  | 'component'
  | 'shader';

export type CreationTool = 'select' | 'frame' | 'rectangle' | 'circle' | 'star' | 'text' | 'image' | 'video' | 'comment';

export type TailwindStyles = {
  // Layout
  display?: string;
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
  gap?: string;
  flexWrap?: string;
  flexGrow?: string;
  flexShrink?: string;

  // Sizing
  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  maxWidth?: string;
  maxHeight?: string;
  aspectRatio?: string;

  // Spacing
  padding?: string;
  paddingX?: string;
  paddingY?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  margin?: string;
  marginX?: string;
  marginY?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;

  // Typography
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  textAlign?: string;
  textColor?: string;
  textColorVisible?: boolean;   // false = text fill hidden in editor, color preserved
  textGradient?: string;        // JSON-serialized GradientFill for text gradient (background-clip: text)
  lineHeight?: string;
  letterSpacing?: string;
  verticalAlign?: string;
  textWrap?: string;  // v4: text-balance, text-pretty
  textDecoration?: string;
  fontStyle?: string;       // italic
  textTransform?: string;
  listStyleType?: string;   // list-disc, list-decimal, list-none
  lineClamp?: string;        // line-clamp-1..6, line-clamp-none

  // Background & Border
  backgroundColor?: string;
  backgroundVisible?: boolean;  // false = fill hidden in editor, color preserved
  backgroundGradient?: string;  // v4: bg-linear-*, bg-radial-*, bg-conic-*
  gradientFrom?: string;
  gradientVia?: string;
  gradientTo?: string;
  gradientStops?: string;  // JSON-encoded GradientStop[] for full fidelity (positions, opacity, 4+ stops)
  backgroundFills?: string;  // JSON-encoded array of fill items for multi-fill support
  borderRadius?: string;
  borderRadiusTopLeft?: string;
  borderRadiusTopRight?: string;
  borderRadiusBottomRight?: string;
  borderRadiusBottomLeft?: string;
  borderWidth?: string;
  borderColor?: string;
  borderStyle?: string;
  borderWidthTop?: string;
  borderWidthRight?: string;
  borderWidthBottom?: string;
  borderWidthLeft?: string;
  borderColorTop?: string;
  borderColorRight?: string;
  borderColorBottom?: string;
  borderColorLeft?: string;

  // Effects
  shadow?: string;
  insetShadow?: string;  // v4: inset-shadow-*
  shadowColor?: string;         // v4: shadow-<color>, shadow-[#hex]
  insetShadowColor?: string;    // v4: inset-shadow-<color>
  shadowAngle?: string;           // custom angle override (degrees, e.g. "45")
  shadowDistance?: string;        // custom distance override (px, e.g. "25")
  shadowBrightness?: string;     // custom brightness override (%, e.g. "42")
  shadowElevation?: string;      // custom elevation override (%, e.g. "70")
  insetShadowAngle?: string;
  insetShadowDistance?: string;
  insetShadowBrightness?: string;
  insetShadowElevation?: string;
  opacity?: string;
  mixBlendMode?: string;
  backdropBlur?: string;
  blur?: string;
  brightness?: string;
  contrast?: string;
  hueRotate?: string;
  invert?: string;
  saturate?: string;
  sepia?: string;
  backdropBrightness?: string;
  backdropContrast?: string;
  backdropHueRotate?: string;
  backdropInvert?: string;
  backdropSaturate?: string;
  backdropSepia?: string;
  hiddenFilters?: string; // JSON array of hidden filter keys, e.g. '["layer-blur","backdrop-invert"]'

  // 3D Transforms (v4)
  rotateX?: string;
  rotateY?: string;
  rotateZ?: string;
  perspective?: string;
  transformStyle?: string;  // transform-3d, transform-flat

  // 2D Transforms
  scale?: string;
  scaleX?: string;
  scaleY?: string;
  rotate?: string;
  translateX?: string;
  translateY?: string;

  // Transitions & Animation
  transition?: string;
  transitionDuration?: string;
  animation?: string;

  // Position
  position?: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  inset?: string;
  zIndex?: string;
  overflow?: string;
  overflowX?: string;
  overflowY?: string;

  // Object fit/position (for images/video)
  objectFit?: string;
  objectPosition?: string;

  // Interactivity
  cursor?: string;
  pointerEvents?: string;

  // Custom classes
  customClasses?: string;
}

export const TAILWIND_OPTIONS = {
  // Display
  display: ['block', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid', 'hidden', 'contents', 'list-item'],

  // Flex Direction
  flexDirection: ['flex-row', 'flex-col', 'flex-row-reverse', 'flex-col-reverse'],

  // Flex Wrap
  flexWrap: ['flex-wrap', 'flex-nowrap', 'flex-wrap-reverse'],

  // Flex Grow/Shrink
  flexGrow: ['grow', 'grow-0'],
  flexShrink: ['shrink', 'shrink-0'],

  // Justify Content
  justifyContent: ['justify-start', 'justify-center', 'justify-end', 'justify-between', 'justify-around', 'justify-evenly', 'justify-stretch'],

  // Align Items
  alignItems: ['items-start', 'items-center', 'items-end', 'items-stretch', 'items-baseline'],

  // Gap
  gap: ['gap-0', 'gap-0.5', 'gap-1', 'gap-1.5', 'gap-2', 'gap-2.5', 'gap-3', 'gap-3.5', 'gap-4', 'gap-5', 'gap-6', 'gap-7', 'gap-8', 'gap-9', 'gap-10', 'gap-12', 'gap-14', 'gap-16', 'gap-20', 'gap-24'],

  // Width
  width: ['w-auto', 'w-full', 'w-screen', 'w-svw', 'w-lvw', 'w-dvw', 'w-min', 'w-max', 'w-fit', 'w-1/2', 'w-1/3', 'w-2/3', 'w-1/4', 'w-2/4', 'w-3/4', 'w-1/5', 'w-2/5', 'w-3/5', 'w-4/5', 'w-8', 'w-10', 'w-12', 'w-16', 'w-20', 'w-24', 'w-28', 'w-32', 'w-36', 'w-40', 'w-44', 'w-48', 'w-52', 'w-56', 'w-60', 'w-64', 'w-72', 'w-80', 'w-96'],

  // Height
  height: ['h-auto', 'h-full', 'h-screen', 'h-svh', 'h-lvh', 'h-dvh', 'h-min', 'h-max', 'h-fit', 'h-1/2', 'h-1/3', 'h-2/3', 'h-1/4', 'h-2/4', 'h-3/4', 'h-8', 'h-10', 'h-12', 'h-16', 'h-20', 'h-24', 'h-28', 'h-32', 'h-36', 'h-40', 'h-44', 'h-48', 'h-52', 'h-56', 'h-60', 'h-64', 'h-72', 'h-80', 'h-96'],

  // Min/Max Width
  minWidth: ['min-w-0', 'min-w-full', 'min-w-min', 'min-w-max', 'min-w-fit'],
  maxWidth: ['max-w-none', 'max-w-0', 'max-w-xs', 'max-w-sm', 'max-w-md', 'max-w-lg', 'max-w-xl', 'max-w-2xl', 'max-w-3xl', 'max-w-4xl', 'max-w-5xl', 'max-w-6xl', 'max-w-7xl', 'max-w-full', 'max-w-min', 'max-w-max', 'max-w-fit', 'max-w-prose', 'max-w-screen-sm', 'max-w-screen-md', 'max-w-screen-lg', 'max-w-screen-xl', 'max-w-screen-2xl'],

  // Min/Max Height
  minHeight: ['min-h-0', 'min-h-full', 'min-h-screen', 'min-h-svh', 'min-h-lvh', 'min-h-dvh', 'min-h-min', 'min-h-max', 'min-h-fit'],
  maxHeight: ['max-h-none', 'max-h-full', 'max-h-screen', 'max-h-svh', 'max-h-lvh', 'max-h-dvh', 'max-h-min', 'max-h-max', 'max-h-fit'],

  // Aspect Ratio
  aspectRatio: ['aspect-auto', 'aspect-square', 'aspect-video', 'aspect-4/3', 'aspect-3/2', 'aspect-16/9', 'aspect-2/1', 'aspect-3/4', 'aspect-9/16'],

  // Padding
  padding: ['p-0', 'p-0.5', 'p-1', 'p-1.5', 'p-2', 'p-2.5', 'p-3', 'p-3.5', 'p-4', 'p-5', 'p-6', 'p-7', 'p-8', 'p-9', 'p-10', 'p-11', 'p-12', 'p-14', 'p-16', 'p-20', 'p-24'],
  paddingX: ['px-0', 'px-0.5', 'px-1', 'px-1.5', 'px-2', 'px-2.5', 'px-3', 'px-3.5', 'px-4', 'px-5', 'px-6', 'px-7', 'px-8', 'px-9', 'px-10', 'px-12', 'px-14', 'px-16', 'px-20', 'px-24'],
  paddingY: ['py-0', 'py-0.5', 'py-1', 'py-1.5', 'py-2', 'py-2.5', 'py-3', 'py-3.5', 'py-4', 'py-5', 'py-6', 'py-7', 'py-8', 'py-9', 'py-10', 'py-12', 'py-14', 'py-16', 'py-20', 'py-24'],
  paddingTop: ['pt-0', 'pt-0.5', 'pt-1', 'pt-1.5', 'pt-2', 'pt-2.5', 'pt-3', 'pt-3.5', 'pt-4', 'pt-5', 'pt-6', 'pt-8', 'pt-10', 'pt-12', 'pt-16', 'pt-20', 'pt-24'],
  paddingRight: ['pr-0', 'pr-0.5', 'pr-1', 'pr-1.5', 'pr-2', 'pr-2.5', 'pr-3', 'pr-3.5', 'pr-4', 'pr-5', 'pr-6', 'pr-8', 'pr-10', 'pr-12', 'pr-16', 'pr-20', 'pr-24'],
  paddingBottom: ['pb-0', 'pb-0.5', 'pb-1', 'pb-1.5', 'pb-2', 'pb-2.5', 'pb-3', 'pb-3.5', 'pb-4', 'pb-5', 'pb-6', 'pb-8', 'pb-10', 'pb-12', 'pb-16', 'pb-20', 'pb-24'],
  paddingLeft: ['pl-0', 'pl-0.5', 'pl-1', 'pl-1.5', 'pl-2', 'pl-2.5', 'pl-3', 'pl-3.5', 'pl-4', 'pl-5', 'pl-6', 'pl-8', 'pl-10', 'pl-12', 'pl-16', 'pl-20', 'pl-24'],

  // Margin
  margin: ['m-0', 'm-0.5', 'm-1', 'm-1.5', 'm-2', 'm-2.5', 'm-3', 'm-3.5', 'm-4', 'm-5', 'm-6', 'm-8', 'm-10', 'm-12', 'm-auto'],
  marginX: ['mx-0', 'mx-0.5', 'mx-1', 'mx-1.5', 'mx-2', 'mx-2.5', 'mx-3', 'mx-3.5', 'mx-4', 'mx-5', 'mx-6', 'mx-8', 'mx-10', 'mx-12', 'mx-auto'],
  marginY: ['my-0', 'my-0.5', 'my-1', 'my-1.5', 'my-2', 'my-2.5', 'my-3', 'my-3.5', 'my-4', 'my-5', 'my-6', 'my-8', 'my-10', 'my-12', 'my-auto'],
  marginTop: ['mt-0', 'mt-0.5', 'mt-1', 'mt-1.5', 'mt-2', 'mt-2.5', 'mt-3', 'mt-3.5', 'mt-4', 'mt-5', 'mt-6', 'mt-8', 'mt-10', 'mt-12', 'mt-auto'],
  marginRight: ['mr-0', 'mr-0.5', 'mr-1', 'mr-1.5', 'mr-2', 'mr-2.5', 'mr-3', 'mr-3.5', 'mr-4', 'mr-5', 'mr-6', 'mr-8', 'mr-10', 'mr-12', 'mr-auto'],
  marginBottom: ['mb-0', 'mb-0.5', 'mb-1', 'mb-1.5', 'mb-2', 'mb-2.5', 'mb-3', 'mb-3.5', 'mb-4', 'mb-5', 'mb-6', 'mb-8', 'mb-10', 'mb-12', 'mb-auto'],
  marginLeft: ['ml-0', 'ml-0.5', 'ml-1', 'ml-1.5', 'ml-2', 'ml-2.5', 'ml-3', 'ml-3.5', 'ml-4', 'ml-5', 'ml-6', 'ml-8', 'ml-10', 'ml-12', 'ml-auto'],

  // Font Size
  fontSize: ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl', 'text-7xl', 'text-8xl', 'text-9xl'],

  // Font Weight
  fontWeight: ['font-thin', 'font-extralight', 'font-light', 'font-normal', 'font-medium', 'font-semibold', 'font-bold', 'font-extrabold', 'font-black'],

  // Text Align
  textAlign: ['text-left', 'text-center', 'text-right', 'text-justify', 'text-start', 'text-end'],

  // Text Color (full Tailwind palette)
  textColor: [
    // Theme colors
    'text-foreground', 'text-primary', 'text-primary-foreground', 'text-secondary', 'text-secondary-foreground', 'text-muted-foreground', 'text-accent-foreground', 'text-destructive', 'text-destructive-foreground',
    // Special
    'text-white', 'text-black', 'text-transparent', 'text-current', 'text-inherit',
    // Slate
    'text-slate-50', 'text-slate-100', 'text-slate-200', 'text-slate-300', 'text-slate-400', 'text-slate-500', 'text-slate-600', 'text-slate-700', 'text-slate-800', 'text-slate-900', 'text-slate-950',
    // Gray
    'text-gray-50', 'text-gray-100', 'text-gray-200', 'text-gray-300', 'text-gray-400', 'text-gray-500', 'text-gray-600', 'text-gray-700', 'text-gray-800', 'text-gray-900', 'text-gray-950',
    // Zinc
    'text-zinc-50', 'text-zinc-100', 'text-zinc-200', 'text-zinc-300', 'text-zinc-400', 'text-zinc-500', 'text-zinc-600', 'text-zinc-700', 'text-zinc-800', 'text-zinc-900', 'text-zinc-950',
    // Neutral
    'text-neutral-50', 'text-neutral-100', 'text-neutral-200', 'text-neutral-300', 'text-neutral-400', 'text-neutral-500', 'text-neutral-600', 'text-neutral-700', 'text-neutral-800', 'text-neutral-900', 'text-neutral-950',
    // Stone
    'text-stone-50', 'text-stone-100', 'text-stone-200', 'text-stone-300', 'text-stone-400', 'text-stone-500', 'text-stone-600', 'text-stone-700', 'text-stone-800', 'text-stone-900', 'text-stone-950',
    // Red
    'text-red-50', 'text-red-100', 'text-red-200', 'text-red-300', 'text-red-400', 'text-red-500', 'text-red-600', 'text-red-700', 'text-red-800', 'text-red-900', 'text-red-950',
    // Orange
    'text-orange-50', 'text-orange-100', 'text-orange-200', 'text-orange-300', 'text-orange-400', 'text-orange-500', 'text-orange-600', 'text-orange-700', 'text-orange-800', 'text-orange-900', 'text-orange-950',
    // Amber
    'text-amber-50', 'text-amber-100', 'text-amber-200', 'text-amber-300', 'text-amber-400', 'text-amber-500', 'text-amber-600', 'text-amber-700', 'text-amber-800', 'text-amber-900', 'text-amber-950',
    // Yellow
    'text-yellow-50', 'text-yellow-100', 'text-yellow-200', 'text-yellow-300', 'text-yellow-400', 'text-yellow-500', 'text-yellow-600', 'text-yellow-700', 'text-yellow-800', 'text-yellow-900', 'text-yellow-950',
    // Lime
    'text-lime-50', 'text-lime-100', 'text-lime-200', 'text-lime-300', 'text-lime-400', 'text-lime-500', 'text-lime-600', 'text-lime-700', 'text-lime-800', 'text-lime-900', 'text-lime-950',
    // Green
    'text-green-50', 'text-green-100', 'text-green-200', 'text-green-300', 'text-green-400', 'text-green-500', 'text-green-600', 'text-green-700', 'text-green-800', 'text-green-900', 'text-green-950',
    // Emerald
    'text-emerald-50', 'text-emerald-100', 'text-emerald-200', 'text-emerald-300', 'text-emerald-400', 'text-emerald-500', 'text-emerald-600', 'text-emerald-700', 'text-emerald-800', 'text-emerald-900', 'text-emerald-950',
    // Teal
    'text-teal-50', 'text-teal-100', 'text-teal-200', 'text-teal-300', 'text-teal-400', 'text-teal-500', 'text-teal-600', 'text-teal-700', 'text-teal-800', 'text-teal-900', 'text-teal-950',
    // Cyan
    'text-cyan-50', 'text-cyan-100', 'text-cyan-200', 'text-cyan-300', 'text-cyan-400', 'text-cyan-500', 'text-cyan-600', 'text-cyan-700', 'text-cyan-800', 'text-cyan-900', 'text-cyan-950',
    // Sky
    'text-sky-50', 'text-sky-100', 'text-sky-200', 'text-sky-300', 'text-sky-400', 'text-sky-500', 'text-sky-600', 'text-sky-700', 'text-sky-800', 'text-sky-900', 'text-sky-950',
    // Blue
    'text-blue-50', 'text-blue-100', 'text-blue-200', 'text-blue-300', 'text-blue-400', 'text-blue-500', 'text-blue-600', 'text-blue-700', 'text-blue-800', 'text-blue-900', 'text-blue-950',
    // Indigo
    'text-indigo-50', 'text-indigo-100', 'text-indigo-200', 'text-indigo-300', 'text-indigo-400', 'text-indigo-500', 'text-indigo-600', 'text-indigo-700', 'text-indigo-800', 'text-indigo-900', 'text-indigo-950',
    // Violet
    'text-violet-50', 'text-violet-100', 'text-violet-200', 'text-violet-300', 'text-violet-400', 'text-violet-500', 'text-violet-600', 'text-violet-700', 'text-violet-800', 'text-violet-900', 'text-violet-950',
    // Purple
    'text-purple-50', 'text-purple-100', 'text-purple-200', 'text-purple-300', 'text-purple-400', 'text-purple-500', 'text-purple-600', 'text-purple-700', 'text-purple-800', 'text-purple-900', 'text-purple-950',
    // Fuchsia
    'text-fuchsia-50', 'text-fuchsia-100', 'text-fuchsia-200', 'text-fuchsia-300', 'text-fuchsia-400', 'text-fuchsia-500', 'text-fuchsia-600', 'text-fuchsia-700', 'text-fuchsia-800', 'text-fuchsia-900', 'text-fuchsia-950',
    // Pink
    'text-pink-50', 'text-pink-100', 'text-pink-200', 'text-pink-300', 'text-pink-400', 'text-pink-500', 'text-pink-600', 'text-pink-700', 'text-pink-800', 'text-pink-900', 'text-pink-950',
    // Rose
    'text-rose-50', 'text-rose-100', 'text-rose-200', 'text-rose-300', 'text-rose-400', 'text-rose-500', 'text-rose-600', 'text-rose-700', 'text-rose-800', 'text-rose-900', 'text-rose-950',
  ],

  // Line Height
  lineHeight: ['leading-none', 'leading-tight', 'leading-snug', 'leading-normal', 'leading-relaxed', 'leading-loose', 'leading-3', 'leading-4', 'leading-5', 'leading-6', 'leading-7', 'leading-8', 'leading-9', 'leading-10'],

  // Letter Spacing
  letterSpacing: ['tracking-tighter', 'tracking-tight', 'tracking-normal', 'tracking-wide', 'tracking-wider', 'tracking-widest'],

  // Text Wrap (v4)
  textWrap: ['text-wrap', 'text-nowrap', 'text-balance', 'text-pretty'],

  // Text Decoration
  textDecoration: ['underline', 'overline', 'line-through', 'no-underline'],

  // Text Transform
  textTransform: ['uppercase', 'lowercase', 'capitalize', 'normal-case'],

  // List Style Type
  listStyleType: ['list-none', 'list-disc', 'list-decimal'],

  // Line Clamp
  lineClamp: ['line-clamp-none', 'line-clamp-1', 'line-clamp-2', 'line-clamp-3', 'line-clamp-4', 'line-clamp-5', 'line-clamp-6'],

  // Vertical Align
  verticalAlign: ['align-baseline', 'align-top', 'align-middle', 'align-bottom', 'align-text-top', 'align-text-bottom', 'align-sub', 'align-super'],

  // Background Color (full Tailwind palette)
  backgroundColor: [
    // Theme colors
    'bg-background', 'bg-foreground', 'bg-card', 'bg-card-foreground', 'bg-primary', 'bg-primary-foreground', 'bg-secondary', 'bg-secondary-foreground', 'bg-muted', 'bg-muted-foreground', 'bg-accent', 'bg-accent-foreground', 'bg-popover', 'bg-popover-foreground', 'bg-destructive', 'bg-destructive-foreground',
    // Special
    'bg-transparent', 'bg-white', 'bg-black', 'bg-current', 'bg-inherit',
    // Slate
    'bg-slate-50', 'bg-slate-100', 'bg-slate-200', 'bg-slate-300', 'bg-slate-400', 'bg-slate-500', 'bg-slate-600', 'bg-slate-700', 'bg-slate-800', 'bg-slate-900', 'bg-slate-950',
    // Gray
    'bg-gray-50', 'bg-gray-100', 'bg-gray-200', 'bg-gray-300', 'bg-gray-400', 'bg-gray-500', 'bg-gray-600', 'bg-gray-700', 'bg-gray-800', 'bg-gray-900', 'bg-gray-950',
    // Zinc
    'bg-zinc-50', 'bg-zinc-100', 'bg-zinc-200', 'bg-zinc-300', 'bg-zinc-400', 'bg-zinc-500', 'bg-zinc-600', 'bg-zinc-700', 'bg-zinc-800', 'bg-zinc-900', 'bg-zinc-950',
    // Neutral
    'bg-neutral-50', 'bg-neutral-100', 'bg-neutral-200', 'bg-neutral-300', 'bg-neutral-400', 'bg-neutral-500', 'bg-neutral-600', 'bg-neutral-700', 'bg-neutral-800', 'bg-neutral-900', 'bg-neutral-950',
    // Stone
    'bg-stone-50', 'bg-stone-100', 'bg-stone-200', 'bg-stone-300', 'bg-stone-400', 'bg-stone-500', 'bg-stone-600', 'bg-stone-700', 'bg-stone-800', 'bg-stone-900', 'bg-stone-950',
    // Red
    'bg-red-50', 'bg-red-100', 'bg-red-200', 'bg-red-300', 'bg-red-400', 'bg-red-500', 'bg-red-600', 'bg-red-700', 'bg-red-800', 'bg-red-900', 'bg-red-950',
    // Orange
    'bg-orange-50', 'bg-orange-100', 'bg-orange-200', 'bg-orange-300', 'bg-orange-400', 'bg-orange-500', 'bg-orange-600', 'bg-orange-700', 'bg-orange-800', 'bg-orange-900', 'bg-orange-950',
    // Amber
    'bg-amber-50', 'bg-amber-100', 'bg-amber-200', 'bg-amber-300', 'bg-amber-400', 'bg-amber-500', 'bg-amber-600', 'bg-amber-700', 'bg-amber-800', 'bg-amber-900', 'bg-amber-950',
    // Yellow
    'bg-yellow-50', 'bg-yellow-100', 'bg-yellow-200', 'bg-yellow-300', 'bg-yellow-400', 'bg-yellow-500', 'bg-yellow-600', 'bg-yellow-700', 'bg-yellow-800', 'bg-yellow-900', 'bg-yellow-950',
    // Lime
    'bg-lime-50', 'bg-lime-100', 'bg-lime-200', 'bg-lime-300', 'bg-lime-400', 'bg-lime-500', 'bg-lime-600', 'bg-lime-700', 'bg-lime-800', 'bg-lime-900', 'bg-lime-950',
    // Green
    'bg-green-50', 'bg-green-100', 'bg-green-200', 'bg-green-300', 'bg-green-400', 'bg-green-500', 'bg-green-600', 'bg-green-700', 'bg-green-800', 'bg-green-900', 'bg-green-950',
    // Emerald
    'bg-emerald-50', 'bg-emerald-100', 'bg-emerald-200', 'bg-emerald-300', 'bg-emerald-400', 'bg-emerald-500', 'bg-emerald-600', 'bg-emerald-700', 'bg-emerald-800', 'bg-emerald-900', 'bg-emerald-950',
    // Teal
    'bg-teal-50', 'bg-teal-100', 'bg-teal-200', 'bg-teal-300', 'bg-teal-400', 'bg-teal-500', 'bg-teal-600', 'bg-teal-700', 'bg-teal-800', 'bg-teal-900', 'bg-teal-950',
    // Cyan
    'bg-cyan-50', 'bg-cyan-100', 'bg-cyan-200', 'bg-cyan-300', 'bg-cyan-400', 'bg-cyan-500', 'bg-cyan-600', 'bg-cyan-700', 'bg-cyan-800', 'bg-cyan-900', 'bg-cyan-950',
    // Sky
    'bg-sky-50', 'bg-sky-100', 'bg-sky-200', 'bg-sky-300', 'bg-sky-400', 'bg-sky-500', 'bg-sky-600', 'bg-sky-700', 'bg-sky-800', 'bg-sky-900', 'bg-sky-950',
    // Blue
    'bg-blue-50', 'bg-blue-100', 'bg-blue-200', 'bg-blue-300', 'bg-blue-400', 'bg-blue-500', 'bg-blue-600', 'bg-blue-700', 'bg-blue-800', 'bg-blue-900', 'bg-blue-950',
    // Indigo
    'bg-indigo-50', 'bg-indigo-100', 'bg-indigo-200', 'bg-indigo-300', 'bg-indigo-400', 'bg-indigo-500', 'bg-indigo-600', 'bg-indigo-700', 'bg-indigo-800', 'bg-indigo-900', 'bg-indigo-950',
    // Violet
    'bg-violet-50', 'bg-violet-100', 'bg-violet-200', 'bg-violet-300', 'bg-violet-400', 'bg-violet-500', 'bg-violet-600', 'bg-violet-700', 'bg-violet-800', 'bg-violet-900', 'bg-violet-950',
    // Purple
    'bg-purple-50', 'bg-purple-100', 'bg-purple-200', 'bg-purple-300', 'bg-purple-400', 'bg-purple-500', 'bg-purple-600', 'bg-purple-700', 'bg-purple-800', 'bg-purple-900', 'bg-purple-950',
    // Fuchsia
    'bg-fuchsia-50', 'bg-fuchsia-100', 'bg-fuchsia-200', 'bg-fuchsia-300', 'bg-fuchsia-400', 'bg-fuchsia-500', 'bg-fuchsia-600', 'bg-fuchsia-700', 'bg-fuchsia-800', 'bg-fuchsia-900', 'bg-fuchsia-950',
    // Pink
    'bg-pink-50', 'bg-pink-100', 'bg-pink-200', 'bg-pink-300', 'bg-pink-400', 'bg-pink-500', 'bg-pink-600', 'bg-pink-700', 'bg-pink-800', 'bg-pink-900', 'bg-pink-950',
    // Rose
    'bg-rose-50', 'bg-rose-100', 'bg-rose-200', 'bg-rose-300', 'bg-rose-400', 'bg-rose-500', 'bg-rose-600', 'bg-rose-700', 'bg-rose-800', 'bg-rose-900', 'bg-rose-950',
  ],

  // Background Gradient (v4)
  backgroundGradient: ['bg-none', 'bg-gradient-to-t', 'bg-gradient-to-tr', 'bg-gradient-to-r', 'bg-gradient-to-br', 'bg-gradient-to-b', 'bg-gradient-to-bl', 'bg-gradient-to-l', 'bg-gradient-to-tl'],

  // Gradient Colors (common shades for gradients)
  gradientFrom: [
    'from-transparent', 'from-white', 'from-black',
    'from-slate-100', 'from-slate-200', 'from-slate-300', 'from-slate-400', 'from-slate-500', 'from-slate-600', 'from-slate-700', 'from-slate-800', 'from-slate-900',
    'from-gray-100', 'from-gray-200', 'from-gray-300', 'from-gray-400', 'from-gray-500', 'from-gray-600', 'from-gray-700', 'from-gray-800', 'from-gray-900',
    'from-zinc-100', 'from-zinc-200', 'from-zinc-300', 'from-zinc-400', 'from-zinc-500', 'from-zinc-600', 'from-zinc-700', 'from-zinc-800', 'from-zinc-900',
    'from-red-100', 'from-red-200', 'from-red-300', 'from-red-400', 'from-red-500', 'from-red-600', 'from-red-700', 'from-red-800', 'from-red-900',
    'from-orange-100', 'from-orange-200', 'from-orange-300', 'from-orange-400', 'from-orange-500', 'from-orange-600', 'from-orange-700', 'from-orange-800', 'from-orange-900',
    'from-amber-100', 'from-amber-200', 'from-amber-300', 'from-amber-400', 'from-amber-500', 'from-amber-600', 'from-amber-700', 'from-amber-800', 'from-amber-900',
    'from-yellow-100', 'from-yellow-200', 'from-yellow-300', 'from-yellow-400', 'from-yellow-500', 'from-yellow-600', 'from-yellow-700', 'from-yellow-800', 'from-yellow-900',
    'from-lime-100', 'from-lime-200', 'from-lime-300', 'from-lime-400', 'from-lime-500', 'from-lime-600', 'from-lime-700', 'from-lime-800', 'from-lime-900',
    'from-green-100', 'from-green-200', 'from-green-300', 'from-green-400', 'from-green-500', 'from-green-600', 'from-green-700', 'from-green-800', 'from-green-900',
    'from-emerald-100', 'from-emerald-200', 'from-emerald-300', 'from-emerald-400', 'from-emerald-500', 'from-emerald-600', 'from-emerald-700', 'from-emerald-800', 'from-emerald-900',
    'from-teal-100', 'from-teal-200', 'from-teal-300', 'from-teal-400', 'from-teal-500', 'from-teal-600', 'from-teal-700', 'from-teal-800', 'from-teal-900',
    'from-cyan-100', 'from-cyan-200', 'from-cyan-300', 'from-cyan-400', 'from-cyan-500', 'from-cyan-600', 'from-cyan-700', 'from-cyan-800', 'from-cyan-900',
    'from-sky-100', 'from-sky-200', 'from-sky-300', 'from-sky-400', 'from-sky-500', 'from-sky-600', 'from-sky-700', 'from-sky-800', 'from-sky-900',
    'from-blue-100', 'from-blue-200', 'from-blue-300', 'from-blue-400', 'from-blue-500', 'from-blue-600', 'from-blue-700', 'from-blue-800', 'from-blue-900',
    'from-indigo-100', 'from-indigo-200', 'from-indigo-300', 'from-indigo-400', 'from-indigo-500', 'from-indigo-600', 'from-indigo-700', 'from-indigo-800', 'from-indigo-900',
    'from-violet-100', 'from-violet-200', 'from-violet-300', 'from-violet-400', 'from-violet-500', 'from-violet-600', 'from-violet-700', 'from-violet-800', 'from-violet-900',
    'from-purple-100', 'from-purple-200', 'from-purple-300', 'from-purple-400', 'from-purple-500', 'from-purple-600', 'from-purple-700', 'from-purple-800', 'from-purple-900',
    'from-fuchsia-100', 'from-fuchsia-200', 'from-fuchsia-300', 'from-fuchsia-400', 'from-fuchsia-500', 'from-fuchsia-600', 'from-fuchsia-700', 'from-fuchsia-800', 'from-fuchsia-900',
    'from-pink-100', 'from-pink-200', 'from-pink-300', 'from-pink-400', 'from-pink-500', 'from-pink-600', 'from-pink-700', 'from-pink-800', 'from-pink-900',
    'from-rose-100', 'from-rose-200', 'from-rose-300', 'from-rose-400', 'from-rose-500', 'from-rose-600', 'from-rose-700', 'from-rose-800', 'from-rose-900',
  ],
  gradientVia: [
    'via-transparent', 'via-white', 'via-black',
    'via-slate-100', 'via-slate-200', 'via-slate-300', 'via-slate-400', 'via-slate-500', 'via-slate-600', 'via-slate-700', 'via-slate-800', 'via-slate-900',
    'via-gray-100', 'via-gray-200', 'via-gray-300', 'via-gray-400', 'via-gray-500', 'via-gray-600', 'via-gray-700', 'via-gray-800', 'via-gray-900',
    'via-zinc-100', 'via-zinc-200', 'via-zinc-300', 'via-zinc-400', 'via-zinc-500', 'via-zinc-600', 'via-zinc-700', 'via-zinc-800', 'via-zinc-900',
    'via-red-100', 'via-red-200', 'via-red-300', 'via-red-400', 'via-red-500', 'via-red-600', 'via-red-700', 'via-red-800', 'via-red-900',
    'via-orange-100', 'via-orange-200', 'via-orange-300', 'via-orange-400', 'via-orange-500', 'via-orange-600', 'via-orange-700', 'via-orange-800', 'via-orange-900',
    'via-amber-100', 'via-amber-200', 'via-amber-300', 'via-amber-400', 'via-amber-500', 'via-amber-600', 'via-amber-700', 'via-amber-800', 'via-amber-900',
    'via-yellow-100', 'via-yellow-200', 'via-yellow-300', 'via-yellow-400', 'via-yellow-500', 'via-yellow-600', 'via-yellow-700', 'via-yellow-800', 'via-yellow-900',
    'via-lime-100', 'via-lime-200', 'via-lime-300', 'via-lime-400', 'via-lime-500', 'via-lime-600', 'via-lime-700', 'via-lime-800', 'via-lime-900',
    'via-green-100', 'via-green-200', 'via-green-300', 'via-green-400', 'via-green-500', 'via-green-600', 'via-green-700', 'via-green-800', 'via-green-900',
    'via-emerald-100', 'via-emerald-200', 'via-emerald-300', 'via-emerald-400', 'via-emerald-500', 'via-emerald-600', 'via-emerald-700', 'via-emerald-800', 'via-emerald-900',
    'via-teal-100', 'via-teal-200', 'via-teal-300', 'via-teal-400', 'via-teal-500', 'via-teal-600', 'via-teal-700', 'via-teal-800', 'via-teal-900',
    'via-cyan-100', 'via-cyan-200', 'via-cyan-300', 'via-cyan-400', 'via-cyan-500', 'via-cyan-600', 'via-cyan-700', 'via-cyan-800', 'via-cyan-900',
    'via-sky-100', 'via-sky-200', 'via-sky-300', 'via-sky-400', 'via-sky-500', 'via-sky-600', 'via-sky-700', 'via-sky-800', 'via-sky-900',
    'via-blue-100', 'via-blue-200', 'via-blue-300', 'via-blue-400', 'via-blue-500', 'via-blue-600', 'via-blue-700', 'via-blue-800', 'via-blue-900',
    'via-indigo-100', 'via-indigo-200', 'via-indigo-300', 'via-indigo-400', 'via-indigo-500', 'via-indigo-600', 'via-indigo-700', 'via-indigo-800', 'via-indigo-900',
    'via-violet-100', 'via-violet-200', 'via-violet-300', 'via-violet-400', 'via-violet-500', 'via-violet-600', 'via-violet-700', 'via-violet-800', 'via-violet-900',
    'via-purple-100', 'via-purple-200', 'via-purple-300', 'via-purple-400', 'via-purple-500', 'via-purple-600', 'via-purple-700', 'via-purple-800', 'via-purple-900',
    'via-fuchsia-100', 'via-fuchsia-200', 'via-fuchsia-300', 'via-fuchsia-400', 'via-fuchsia-500', 'via-fuchsia-600', 'via-fuchsia-700', 'via-fuchsia-800', 'via-fuchsia-900',
    'via-pink-100', 'via-pink-200', 'via-pink-300', 'via-pink-400', 'via-pink-500', 'via-pink-600', 'via-pink-700', 'via-pink-800', 'via-pink-900',
    'via-rose-100', 'via-rose-200', 'via-rose-300', 'via-rose-400', 'via-rose-500', 'via-rose-600', 'via-rose-700', 'via-rose-800', 'via-rose-900',
  ],
  gradientTo: [
    'to-transparent', 'to-white', 'to-black',
    'to-slate-100', 'to-slate-200', 'to-slate-300', 'to-slate-400', 'to-slate-500', 'to-slate-600', 'to-slate-700', 'to-slate-800', 'to-slate-900',
    'to-gray-100', 'to-gray-200', 'to-gray-300', 'to-gray-400', 'to-gray-500', 'to-gray-600', 'to-gray-700', 'to-gray-800', 'to-gray-900',
    'to-zinc-100', 'to-zinc-200', 'to-zinc-300', 'to-zinc-400', 'to-zinc-500', 'to-zinc-600', 'to-zinc-700', 'to-zinc-800', 'to-zinc-900',
    'to-red-100', 'to-red-200', 'to-red-300', 'to-red-400', 'to-red-500', 'to-red-600', 'to-red-700', 'to-red-800', 'to-red-900',
    'to-orange-100', 'to-orange-200', 'to-orange-300', 'to-orange-400', 'to-orange-500', 'to-orange-600', 'to-orange-700', 'to-orange-800', 'to-orange-900',
    'to-amber-100', 'to-amber-200', 'to-amber-300', 'to-amber-400', 'to-amber-500', 'to-amber-600', 'to-amber-700', 'to-amber-800', 'to-amber-900',
    'to-yellow-100', 'to-yellow-200', 'to-yellow-300', 'to-yellow-400', 'to-yellow-500', 'to-yellow-600', 'to-yellow-700', 'to-yellow-800', 'to-yellow-900',
    'to-lime-100', 'to-lime-200', 'to-lime-300', 'to-lime-400', 'to-lime-500', 'to-lime-600', 'to-lime-700', 'to-lime-800', 'to-lime-900',
    'to-green-100', 'to-green-200', 'to-green-300', 'to-green-400', 'to-green-500', 'to-green-600', 'to-green-700', 'to-green-800', 'to-green-900',
    'to-emerald-100', 'to-emerald-200', 'to-emerald-300', 'to-emerald-400', 'to-emerald-500', 'to-emerald-600', 'to-emerald-700', 'to-emerald-800', 'to-emerald-900',
    'to-teal-100', 'to-teal-200', 'to-teal-300', 'to-teal-400', 'to-teal-500', 'to-teal-600', 'to-teal-700', 'to-teal-800', 'to-teal-900',
    'to-cyan-100', 'to-cyan-200', 'to-cyan-300', 'to-cyan-400', 'to-cyan-500', 'to-cyan-600', 'to-cyan-700', 'to-cyan-800', 'to-cyan-900',
    'to-sky-100', 'to-sky-200', 'to-sky-300', 'to-sky-400', 'to-sky-500', 'to-sky-600', 'to-sky-700', 'to-sky-800', 'to-sky-900',
    'to-blue-100', 'to-blue-200', 'to-blue-300', 'to-blue-400', 'to-blue-500', 'to-blue-600', 'to-blue-700', 'to-blue-800', 'to-blue-900',
    'to-indigo-100', 'to-indigo-200', 'to-indigo-300', 'to-indigo-400', 'to-indigo-500', 'to-indigo-600', 'to-indigo-700', 'to-indigo-800', 'to-indigo-900',
    'to-violet-100', 'to-violet-200', 'to-violet-300', 'to-violet-400', 'to-violet-500', 'to-violet-600', 'to-violet-700', 'to-violet-800', 'to-violet-900',
    'to-purple-100', 'to-purple-200', 'to-purple-300', 'to-purple-400', 'to-purple-500', 'to-purple-600', 'to-purple-700', 'to-purple-800', 'to-purple-900',
    'to-fuchsia-100', 'to-fuchsia-200', 'to-fuchsia-300', 'to-fuchsia-400', 'to-fuchsia-500', 'to-fuchsia-600', 'to-fuchsia-700', 'to-fuchsia-800', 'to-fuchsia-900',
    'to-pink-100', 'to-pink-200', 'to-pink-300', 'to-pink-400', 'to-pink-500', 'to-pink-600', 'to-pink-700', 'to-pink-800', 'to-pink-900',
    'to-rose-100', 'to-rose-200', 'to-rose-300', 'to-rose-400', 'to-rose-500', 'to-rose-600', 'to-rose-700', 'to-rose-800', 'to-rose-900',
  ],

  // Border Radius
  borderRadius: ['rounded-none', 'rounded-sm', 'rounded', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-3xl', 'rounded-full'],
  borderRadiusTopLeft: ['rounded-tl-none', 'rounded-tl-sm', 'rounded-tl', 'rounded-tl-md', 'rounded-tl-lg', 'rounded-tl-xl', 'rounded-tl-2xl', 'rounded-tl-3xl', 'rounded-tl-full'],
  borderRadiusTopRight: ['rounded-tr-none', 'rounded-tr-sm', 'rounded-tr', 'rounded-tr-md', 'rounded-tr-lg', 'rounded-tr-xl', 'rounded-tr-2xl', 'rounded-tr-3xl', 'rounded-tr-full'],
  borderRadiusBottomRight: ['rounded-br-none', 'rounded-br-sm', 'rounded-br', 'rounded-br-md', 'rounded-br-lg', 'rounded-br-xl', 'rounded-br-2xl', 'rounded-br-3xl', 'rounded-br-full'],
  borderRadiusBottomLeft: ['rounded-bl-none', 'rounded-bl-sm', 'rounded-bl', 'rounded-bl-md', 'rounded-bl-lg', 'rounded-bl-xl', 'rounded-bl-2xl', 'rounded-bl-3xl', 'rounded-bl-full'],

  // Border Width
  borderWidth: ['border-0', 'border', 'border-2', 'border-4', 'border-8'],

  // Border Color (full Tailwind palette)
  borderColor: [
    // Theme colors
    'border-border', 'border-primary', 'border-secondary', 'border-muted', 'border-accent', 'border-destructive', 'border-ring',
    // Special
    'border-transparent', 'border-white', 'border-black', 'border-current', 'border-inherit',
    // Slate
    'border-slate-50', 'border-slate-100', 'border-slate-200', 'border-slate-300', 'border-slate-400', 'border-slate-500', 'border-slate-600', 'border-slate-700', 'border-slate-800', 'border-slate-900', 'border-slate-950',
    // Gray
    'border-gray-50', 'border-gray-100', 'border-gray-200', 'border-gray-300', 'border-gray-400', 'border-gray-500', 'border-gray-600', 'border-gray-700', 'border-gray-800', 'border-gray-900', 'border-gray-950',
    // Zinc
    'border-zinc-50', 'border-zinc-100', 'border-zinc-200', 'border-zinc-300', 'border-zinc-400', 'border-zinc-500', 'border-zinc-600', 'border-zinc-700', 'border-zinc-800', 'border-zinc-900', 'border-zinc-950',
    // Neutral
    'border-neutral-50', 'border-neutral-100', 'border-neutral-200', 'border-neutral-300', 'border-neutral-400', 'border-neutral-500', 'border-neutral-600', 'border-neutral-700', 'border-neutral-800', 'border-neutral-900', 'border-neutral-950',
    // Stone
    'border-stone-50', 'border-stone-100', 'border-stone-200', 'border-stone-300', 'border-stone-400', 'border-stone-500', 'border-stone-600', 'border-stone-700', 'border-stone-800', 'border-stone-900', 'border-stone-950',
    // Red
    'border-red-50', 'border-red-100', 'border-red-200', 'border-red-300', 'border-red-400', 'border-red-500', 'border-red-600', 'border-red-700', 'border-red-800', 'border-red-900', 'border-red-950',
    // Orange
    'border-orange-50', 'border-orange-100', 'border-orange-200', 'border-orange-300', 'border-orange-400', 'border-orange-500', 'border-orange-600', 'border-orange-700', 'border-orange-800', 'border-orange-900', 'border-orange-950',
    // Amber
    'border-amber-50', 'border-amber-100', 'border-amber-200', 'border-amber-300', 'border-amber-400', 'border-amber-500', 'border-amber-600', 'border-amber-700', 'border-amber-800', 'border-amber-900', 'border-amber-950',
    // Yellow
    'border-yellow-50', 'border-yellow-100', 'border-yellow-200', 'border-yellow-300', 'border-yellow-400', 'border-yellow-500', 'border-yellow-600', 'border-yellow-700', 'border-yellow-800', 'border-yellow-900', 'border-yellow-950',
    // Lime
    'border-lime-50', 'border-lime-100', 'border-lime-200', 'border-lime-300', 'border-lime-400', 'border-lime-500', 'border-lime-600', 'border-lime-700', 'border-lime-800', 'border-lime-900', 'border-lime-950',
    // Green
    'border-green-50', 'border-green-100', 'border-green-200', 'border-green-300', 'border-green-400', 'border-green-500', 'border-green-600', 'border-green-700', 'border-green-800', 'border-green-900', 'border-green-950',
    // Emerald
    'border-emerald-50', 'border-emerald-100', 'border-emerald-200', 'border-emerald-300', 'border-emerald-400', 'border-emerald-500', 'border-emerald-600', 'border-emerald-700', 'border-emerald-800', 'border-emerald-900', 'border-emerald-950',
    // Teal
    'border-teal-50', 'border-teal-100', 'border-teal-200', 'border-teal-300', 'border-teal-400', 'border-teal-500', 'border-teal-600', 'border-teal-700', 'border-teal-800', 'border-teal-900', 'border-teal-950',
    // Cyan
    'border-cyan-50', 'border-cyan-100', 'border-cyan-200', 'border-cyan-300', 'border-cyan-400', 'border-cyan-500', 'border-cyan-600', 'border-cyan-700', 'border-cyan-800', 'border-cyan-900', 'border-cyan-950',
    // Sky
    'border-sky-50', 'border-sky-100', 'border-sky-200', 'border-sky-300', 'border-sky-400', 'border-sky-500', 'border-sky-600', 'border-sky-700', 'border-sky-800', 'border-sky-900', 'border-sky-950',
    // Blue
    'border-blue-50', 'border-blue-100', 'border-blue-200', 'border-blue-300', 'border-blue-400', 'border-blue-500', 'border-blue-600', 'border-blue-700', 'border-blue-800', 'border-blue-900', 'border-blue-950',
    // Indigo
    'border-indigo-50', 'border-indigo-100', 'border-indigo-200', 'border-indigo-300', 'border-indigo-400', 'border-indigo-500', 'border-indigo-600', 'border-indigo-700', 'border-indigo-800', 'border-indigo-900', 'border-indigo-950',
    // Violet
    'border-violet-50', 'border-violet-100', 'border-violet-200', 'border-violet-300', 'border-violet-400', 'border-violet-500', 'border-violet-600', 'border-violet-700', 'border-violet-800', 'border-violet-900', 'border-violet-950',
    // Purple
    'border-purple-50', 'border-purple-100', 'border-purple-200', 'border-purple-300', 'border-purple-400', 'border-purple-500', 'border-purple-600', 'border-purple-700', 'border-purple-800', 'border-purple-900', 'border-purple-950',
    // Fuchsia
    'border-fuchsia-50', 'border-fuchsia-100', 'border-fuchsia-200', 'border-fuchsia-300', 'border-fuchsia-400', 'border-fuchsia-500', 'border-fuchsia-600', 'border-fuchsia-700', 'border-fuchsia-800', 'border-fuchsia-900', 'border-fuchsia-950',
    // Pink
    'border-pink-50', 'border-pink-100', 'border-pink-200', 'border-pink-300', 'border-pink-400', 'border-pink-500', 'border-pink-600', 'border-pink-700', 'border-pink-800', 'border-pink-900', 'border-pink-950',
    // Rose
    'border-rose-50', 'border-rose-100', 'border-rose-200', 'border-rose-300', 'border-rose-400', 'border-rose-500', 'border-rose-600', 'border-rose-700', 'border-rose-800', 'border-rose-900', 'border-rose-950',
  ],

  // Border Style
  borderStyle: ['border-solid', 'border-dashed', 'border-dotted', 'border-double', 'border-hidden', 'border-none'],

  // Per-side Border Width
  borderWidthTop: ['border-t-0', 'border-t', 'border-t-2', 'border-t-4', 'border-t-8'],
  borderWidthRight: ['border-r-0', 'border-r', 'border-r-2', 'border-r-4', 'border-r-8'],
  borderWidthBottom: ['border-b-0', 'border-b', 'border-b-2', 'border-b-4', 'border-b-8'],
  borderWidthLeft: ['border-l-0', 'border-l', 'border-l-2', 'border-l-4', 'border-l-8'],

  // Shadow (v4: shadow-xs is now the smallest)
  shadow: ['shadow-none', 'shadow-xs', 'shadow-sm', 'shadow', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl', 'shadow-inner'],

  // Inset Shadow (v4)
  insetShadow: ['inset-shadow-none', 'inset-shadow-xs', 'inset-shadow-sm', 'inset-shadow', 'inset-shadow-md', 'inset-shadow-lg'],

  // Opacity
  opacity: ['opacity-0', 'opacity-5', 'opacity-10', 'opacity-15', 'opacity-20', 'opacity-25', 'opacity-30', 'opacity-40', 'opacity-50', 'opacity-60', 'opacity-70', 'opacity-75', 'opacity-80', 'opacity-90', 'opacity-95', 'opacity-100'],

  // Mix Blend Mode
  mixBlendMode: ['mix-blend-normal', 'mix-blend-multiply', 'mix-blend-screen', 'mix-blend-overlay', 'mix-blend-darken', 'mix-blend-lighten', 'mix-blend-color-dodge', 'mix-blend-color-burn', 'mix-blend-hard-light', 'mix-blend-soft-light', 'mix-blend-difference', 'mix-blend-exclusion', 'mix-blend-hue', 'mix-blend-saturation', 'mix-blend-color', 'mix-blend-luminosity', 'mix-blend-plus-darker', 'mix-blend-plus-lighter'],

  // Backdrop Blur
  backdropBlur: ['backdrop-blur-none', 'backdrop-blur-sm', 'backdrop-blur', 'backdrop-blur-md', 'backdrop-blur-lg', 'backdrop-blur-xl', 'backdrop-blur-2xl', 'backdrop-blur-3xl'],

  // Blur
  blur: ['blur-none', 'blur-sm', 'blur', 'blur-md', 'blur-lg', 'blur-xl', 'blur-2xl', 'blur-3xl'],

  // Filters
  brightness: ['brightness-0', 'brightness-50', 'brightness-75', 'brightness-90', 'brightness-95', 'brightness-100', 'brightness-105', 'brightness-110', 'brightness-125', 'brightness-150', 'brightness-200'],
  contrast: ['contrast-0', 'contrast-50', 'contrast-75', 'contrast-100', 'contrast-125', 'contrast-150', 'contrast-200'],
  hueRotate: ['hue-rotate-0', 'hue-rotate-15', 'hue-rotate-30', 'hue-rotate-60', 'hue-rotate-90', 'hue-rotate-180'],
  invert: ['invert-0', 'invert'],
  saturate: ['saturate-0', 'saturate-50', 'saturate-100', 'saturate-150', 'saturate-200'],
  sepia: ['sepia-0', 'sepia'],

  // Backdrop Filters
  backdropBrightness: ['backdrop-brightness-0', 'backdrop-brightness-50', 'backdrop-brightness-75', 'backdrop-brightness-90', 'backdrop-brightness-95', 'backdrop-brightness-100', 'backdrop-brightness-105', 'backdrop-brightness-110', 'backdrop-brightness-125', 'backdrop-brightness-150', 'backdrop-brightness-200'],
  backdropContrast: ['backdrop-contrast-0', 'backdrop-contrast-50', 'backdrop-contrast-75', 'backdrop-contrast-100', 'backdrop-contrast-125', 'backdrop-contrast-150', 'backdrop-contrast-200'],
  backdropHueRotate: ['backdrop-hue-rotate-0', 'backdrop-hue-rotate-15', 'backdrop-hue-rotate-30', 'backdrop-hue-rotate-60', 'backdrop-hue-rotate-90', 'backdrop-hue-rotate-180'],
  backdropInvert: ['backdrop-invert-0', 'backdrop-invert'],
  backdropSaturate: ['backdrop-saturate-0', 'backdrop-saturate-50', 'backdrop-saturate-100', 'backdrop-saturate-150', 'backdrop-saturate-200'],
  backdropSepia: ['backdrop-sepia-0', 'backdrop-sepia'],

  // 3D Transforms (v4)
  rotateX: ['rotate-x-0', 'rotate-x-1', 'rotate-x-2', 'rotate-x-3', 'rotate-x-6', 'rotate-x-12', 'rotate-x-45', 'rotate-x-90', 'rotate-x-180'],
  rotateY: ['rotate-y-0', 'rotate-y-1', 'rotate-y-2', 'rotate-y-3', 'rotate-y-6', 'rotate-y-12', 'rotate-y-45', 'rotate-y-90', 'rotate-y-180'],
  rotateZ: ['rotate-0', 'rotate-1', 'rotate-2', 'rotate-3', 'rotate-6', 'rotate-12', 'rotate-45', 'rotate-90', 'rotate-180', '-rotate-1', '-rotate-2', '-rotate-3', '-rotate-6', '-rotate-12', '-rotate-45', '-rotate-90', '-rotate-180'],
  perspective: ['perspective-none', 'perspective-dramatic', 'perspective-near', 'perspective-normal', 'perspective-midrange', 'perspective-distant'],
  transformStyle: ['transform-3d', 'transform-flat'],

  // 2D Transforms
  scale: ['scale-0', 'scale-50', 'scale-75', 'scale-90', 'scale-95', 'scale-100', 'scale-105', 'scale-110', 'scale-125', 'scale-150', 'scale-200'],
  scaleX: ['scale-x-0', 'scale-x-50', 'scale-x-75', 'scale-x-90', 'scale-x-95', 'scale-x-100', 'scale-x-105', 'scale-x-110', 'scale-x-125', 'scale-x-150', 'scale-x-200', '-scale-x-100'],
  scaleY: ['scale-y-0', 'scale-y-50', 'scale-y-75', 'scale-y-90', 'scale-y-95', 'scale-y-100', 'scale-y-105', 'scale-y-110', 'scale-y-125', 'scale-y-150', 'scale-y-200', '-scale-y-100'],
  rotate: ['rotate-0', 'rotate-1', 'rotate-2', 'rotate-3', 'rotate-6', 'rotate-12', 'rotate-45', 'rotate-90', 'rotate-180', '-rotate-1', '-rotate-2', '-rotate-3', '-rotate-6', '-rotate-12', '-rotate-45', '-rotate-90', '-rotate-180'],
  translateX: ['translate-x-0', 'translate-x-1', 'translate-x-2', 'translate-x-4', 'translate-x-8', 'translate-x-12', 'translate-x-16', 'translate-x-1/2', 'translate-x-full', '-translate-x-1', '-translate-x-2', '-translate-x-4', '-translate-x-8', '-translate-x-1/2', '-translate-x-full'],
  translateY: ['translate-y-0', 'translate-y-1', 'translate-y-2', 'translate-y-4', 'translate-y-8', 'translate-y-12', 'translate-y-16', 'translate-y-1/2', 'translate-y-full', '-translate-y-1', '-translate-y-2', '-translate-y-4', '-translate-y-8', '-translate-y-1/2', '-translate-y-full'],

  // Transitions & Animation
  transition: ['transition-none', 'transition-all', 'transition', 'transition-colors', 'transition-opacity', 'transition-shadow', 'transition-transform'],
  transitionDuration: ['duration-75', 'duration-100', 'duration-150', 'duration-200', 'duration-300', 'duration-500', 'duration-700', 'duration-1000'],
  animation: ['animate-none', 'animate-spin', 'animate-ping', 'animate-pulse', 'animate-bounce'],

  // Position
  position: ['static', 'relative', 'absolute', 'fixed', 'sticky'],
  top: ['top-0', 'top-0.5', 'top-1', 'top-1.5', 'top-2', 'top-2.5', 'top-3', 'top-4', 'top-5', 'top-6', 'top-8', 'top-10', 'top-12', 'top-16', 'top-20', 'top-24', 'top-auto', 'top-1/2', 'top-1/3', 'top-2/3', 'top-1/4', 'top-3/4', 'top-full', '-top-0.5', '-top-1', '-top-1.5', '-top-2', '-top-2.5', '-top-3', '-top-4', '-top-5', '-top-6', '-top-8', '-top-10', '-top-12'],
  right: ['right-0', 'right-0.5', 'right-1', 'right-1.5', 'right-2', 'right-2.5', 'right-3', 'right-4', 'right-5', 'right-6', 'right-8', 'right-10', 'right-12', 'right-16', 'right-20', 'right-24', 'right-auto', 'right-1/2', 'right-1/3', 'right-2/3', 'right-1/4', 'right-3/4', 'right-full', '-right-0.5', '-right-1', '-right-1.5', '-right-2', '-right-2.5', '-right-3', '-right-4', '-right-5', '-right-6', '-right-8', '-right-10', '-right-12'],
  bottom: ['bottom-0', 'bottom-0.5', 'bottom-1', 'bottom-1.5', 'bottom-2', 'bottom-2.5', 'bottom-3', 'bottom-4', 'bottom-5', 'bottom-6', 'bottom-8', 'bottom-10', 'bottom-12', 'bottom-16', 'bottom-20', 'bottom-24', 'bottom-auto', 'bottom-1/2', 'bottom-1/3', 'bottom-2/3', 'bottom-1/4', 'bottom-3/4', 'bottom-full', '-bottom-0.5', '-bottom-1', '-bottom-1.5', '-bottom-2', '-bottom-2.5', '-bottom-3', '-bottom-4', '-bottom-5', '-bottom-6', '-bottom-8', '-bottom-10', '-bottom-12'],
  left: ['left-0', 'left-0.5', 'left-1', 'left-1.5', 'left-2', 'left-2.5', 'left-3', 'left-4', 'left-5', 'left-6', 'left-8', 'left-10', 'left-12', 'left-16', 'left-20', 'left-24', 'left-auto', 'left-1/2', 'left-1/3', 'left-2/3', 'left-1/4', 'left-3/4', 'left-full', '-left-0.5', '-left-1', '-left-1.5', '-left-2', '-left-2.5', '-left-3', '-left-4', '-left-5', '-left-6', '-left-8', '-left-10', '-left-12'],
  inset: ['inset-0', 'inset-0.5', 'inset-1', 'inset-1.5', 'inset-2', 'inset-2.5', 'inset-3', 'inset-4', 'inset-5', 'inset-6', 'inset-8', 'inset-10', 'inset-12', 'inset-auto', '-inset-0.5', '-inset-1', '-inset-1.5', '-inset-2', '-inset-2.5', '-inset-3', '-inset-4'],

  // Z-Index
  zIndex: ['z-0', 'z-10', 'z-20', 'z-30', 'z-40', 'z-50', 'z-auto'],

  // Overflow
  overflow: ['overflow-auto', 'overflow-hidden', 'overflow-visible', 'overflow-scroll', 'overflow-clip'],
  overflowX: ['overflow-x-auto', 'overflow-x-hidden', 'overflow-x-visible', 'overflow-x-scroll', 'overflow-x-clip'],
  overflowY: ['overflow-y-auto', 'overflow-y-hidden', 'overflow-y-visible', 'overflow-y-scroll', 'overflow-y-clip'],

  // Object Fit
  objectFit: ['object-cover', 'object-contain', 'object-fill', 'object-none', 'object-scale-down'],

  // Object Position
  objectPosition: ['object-center', 'object-top', 'object-bottom', 'object-left', 'object-right', 'object-left-top', 'object-left-bottom', 'object-right-top', 'object-right-bottom'],

  // Cursor
  cursor: ['cursor-auto', 'cursor-default', 'cursor-pointer', 'cursor-wait', 'cursor-text', 'cursor-move', 'cursor-help', 'cursor-not-allowed', 'cursor-none', 'cursor-grab', 'cursor-grabbing'],

  // Pointer Events
  pointerEvents: ['pointer-events-none', 'pointer-events-auto'],
} as const;

export type TailwindProperty = keyof typeof TAILWIND_OPTIONS;

// Editor local state (not synced via Yjs)
export interface EditorLocalState {
  selectedIds: string[];           // Multi-selection support
  lastSelectedId: string | null;   // Anchor for shift-click range selection
  focusedContainerId: string | null; // Currently "entered" container (null = page level)
  isDragging: boolean;
  draggedId: string | null;
  viewMode: 'edit' | 'preview';
  device: 'desktop' | 'tablet' | 'mobile';
  previewFont: string | null;
  creationTool: CreationTool;
  panelTab: 'design' | 'animate';
}

// Helper to get effective styles for a device
export function getEffectiveStyles(
  tailwindStyles: TailwindStyles,
  responsiveStyles: ResponsiveStyles | undefined,
  device: 'desktop' | 'tablet' | 'mobile'
): TailwindStyles {
  const base = tailwindStyles;
  const responsive = responsiveStyles;

  if (!responsive) return base;

  // Cascade: base -> tablet -> mobile
  if (device === 'desktop') {
    return { ...base, ...responsive.base };
  }

  if (device === 'tablet') {
    return { ...base, ...responsive.base, ...responsive.tablet };
  }

  // Mobile gets all overrides
  return { ...base, ...responsive.base, ...responsive.tablet, ...responsive.mobile };
}

// Check if a property has a responsive override for a specific device
export function hasResponsiveOverride(
  responsiveStyles: ResponsiveStyles | undefined,
  property: keyof TailwindStyles,
  device: 'tablet' | 'mobile'
): boolean {
  if (!responsiveStyles) return false;

  if (device === 'tablet') {
    return responsiveStyles.tablet?.[property] !== undefined;
  }

  return responsiveStyles.mobile?.[property] !== undefined;
}

// Get which devices have overrides for a property
export function getResponsiveOverrides(
  responsiveStyles: ResponsiveStyles | undefined,
  property: keyof TailwindStyles
): { tablet: boolean; mobile: boolean } {
  return {
    tablet: responsiveStyles?.tablet?.[property] !== undefined,
    mobile: responsiveStyles?.mobile?.[property] !== undefined,
  };
}

// Create default element with Tailwind styles
export function createDefaultTailwindElement(
  type: EditorElementType,
  id: string
): { content: string; tailwindStyles: TailwindStyles; videoAutoplay?: boolean; videoLoop?: boolean; videoControls?: boolean; videoMuted?: boolean } {
  const baseStyles: TailwindStyles = {
    padding: 'p-4',
  };

  switch (type) {
    case 'heading':
      return {
        content: 'New Heading',
        tailwindStyles: {
          ...baseStyles,
          fontSize: 'text-4xl',
          fontWeight: 'font-bold',
          textColor: 'text-foreground',
          fontFamily: 'Inter',
        },
      };
    case 'text':
      return {
        content: 'This is a paragraph of text. Click to edit.',
        tailwindStyles: { fontFamily: 'Inter' },
      };
    case 'button':
      return {
        content: 'Click me',
        tailwindStyles: {
          padding: 'p-0',
          paddingX: 'px-6',
          paddingY: 'py-3',
          fontSize: 'text-sm',
          fontWeight: 'font-medium',
          backgroundColor: 'bg-primary',
          textColor: 'text-primary-foreground',
          borderRadius: 'rounded-lg',
        },
      };
    case 'image':
      return {
        content: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&h=600&fit=crop',
        tailwindStyles: {
          width: 'w-[300px]',
          height: 'h-[200px]',
          borderRadius: 'rounded-lg',
          objectFit: 'object-cover',
          objectPosition: 'object-center',
        },
      };
    case 'video':
      return {
        content: '',
        videoAutoplay: true,
        videoLoop: true,
        videoControls: false,
        videoMuted: true,
        tailwindStyles: {
          width: 'w-[400px]',
          height: 'h-[225px]',
          borderRadius: 'rounded-lg',
          objectFit: 'object-cover',
        },
      };
    case 'container':
      return {
        content: '',
        tailwindStyles: {
          display: 'flex',
          flexDirection: 'flex-col',
          gap: 'gap-4',
        },
      };
    case 'divider':
      return {
        content: '',
        tailwindStyles: {
          width: 'w-full',
          height: 'h-auto',
          borderWidth: 'border',
          borderColor: 'border-border',
          marginY: 'my-4',
        },
      };
    case 'badge':
      return {
        content: 'Badge',
        tailwindStyles: {
          padding: 'p-0',
          paddingX: 'px-3',
          paddingY: 'py-1',
          fontSize: 'text-xs',
          fontWeight: 'font-medium',
          backgroundColor: 'bg-secondary',
          textColor: 'text-secondary-foreground',
          borderRadius: 'rounded-full',
        },
      };
    case 'sticker':
      return {
        content: '',
        tailwindStyles: {},
      };
    case 'link':
      return {
        content: 'Link text',
        tailwindStyles: {
          ...baseStyles,
          fontSize: 'text-base',
          textColor: 'text-primary',
        },
      };
    case 'rectangle':
      return {
        content: '',
        tailwindStyles: {
          width: 'w-[100px]',
          height: 'h-[100px]',
          backgroundColor: 'bg-[#D9D9D9]',
        },
      };
    case 'circle':
      return {
        content: '',
        tailwindStyles: {
          width: 'w-[100px]',
          height: 'h-[100px]',
          backgroundColor: 'bg-[#D9D9D9]',
        },
      };
    case 'star':
      return {
        content: '',
        tailwindStyles: {
          width: 'w-[100px]',
          height: 'h-[100px]',
          backgroundColor: 'bg-[#D9D9D9]',
        },
      };
    case 'gif':
      return {
        content: '',
        tailwindStyles: {
          width: 'w-[300px]',
          borderRadius: 'rounded-lg',
          objectFit: 'object-contain',
        },
      };
    case 'component':
      return {
        content: '',
        tailwindStyles: {
          width: 'w-full',
        },
      };
    case 'shader':
      return {
        content: '',
        tailwindStyles: {
          width: 'w-[300px]',
          height: 'h-[200px]',
        },
      };
    default:
      return {
        content: 'New element',
        tailwindStyles: baseStyles,
      };
  }
}

// Convert TailwindStyles to className string
export function getStyleClasses(styles: TailwindStyles): string {
  const classes: string[] = [];

  // Skip boolean visibility flags and metadata keys
  const skipKeys = new Set(['customClasses', 'backgroundVisible', 'textColorVisible', 'textGradient', 'gradientStops', 'backgroundFills', 'hiddenFilters', 'shadowAngle', 'shadowDistance', 'shadowBrightness', 'shadowElevation', 'insetShadowAngle', 'insetShadowDistance', 'insetShadowBrightness', 'insetShadowElevation']);

  // Add each non-undefined style value
  Object.entries(styles).forEach(([key, value]) => {
    if (value && !skipKeys.has(key)) {
      // Skip backgroundColor and gradient fields when hidden
      if (styles.backgroundVisible === false && (key === 'backgroundColor' || key === 'backgroundGradient' || key === 'gradientFrom' || key === 'gradientVia' || key === 'gradientTo')) return;
      // Skip textColor when hidden
      if (key === 'textColor' && styles.textColorVisible === false) return;
      classes.push(value as string);
    }
  });

  // Add custom classes last
  if (styles.customClasses) {
    classes.push(styles.customClasses);
  }

  return classes.join(' ');
}

// Google Fonts available in the editor
export const GOOGLE_FONTS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Raleway', label: 'Raleway' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Merriweather', label: 'Merriweather' },
  { value: 'Source Sans Pro', label: 'Source Sans Pro' },
  { value: 'Nunito', label: 'Nunito' },
  { value: 'Ubuntu', label: 'Ubuntu' },
  { value: 'Rubik', label: 'Rubik' },
  { value: 'Work Sans', label: 'Work Sans' },
  { value: 'Quicksand', label: 'Quicksand' },
  { value: 'Karla', label: 'Karla' },
  { value: 'Fira Sans', label: 'Fira Sans' },
  { value: 'Cabin', label: 'Cabin' },
  { value: 'Barlow', label: 'Barlow' },
  { value: 'DM Sans', label: 'DM Sans' },
  { value: 'Space Grotesk', label: 'Space Grotesk' },
  { value: 'Sora', label: 'Sora' },
  { value: 'Outfit', label: 'Outfit' },
  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans' },
  { value: 'Manrope', label: 'Manrope' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono' },
  { value: 'Fira Code', label: 'Fira Code' },
  { value: 'Source Code Pro', label: 'Source Code Pro' },
  { value: 'IBM Plex Sans', label: 'IBM Plex Sans' },
  { value: 'IBM Plex Mono', label: 'IBM Plex Mono' },
  { value: 'Lexend', label: 'Lexend' },
  { value: 'Bricolage Grotesque', label: 'Bricolage Grotesque' },
  { value: 'Geist', label: 'Geist' },
  { value: 'Geist Mono', label: 'Geist Mono' },
  { value: 'Instrument Sans', label: 'Instrument Sans' },
  { value: 'General Sans', label: 'General Sans' },
] as const;

// Color swatch mapping for property panel
export const COLOR_SWATCHES: Record<string, string> = {
  // Theme colors (CSS variables)
  'bg-background': 'var(--background)',
  'bg-foreground': 'var(--foreground)',
  'bg-card': 'var(--card)',
  'bg-primary': 'var(--primary)',
  'bg-secondary': 'var(--secondary)',
  'bg-muted': 'var(--muted)',
  'bg-accent': 'var(--accent)',
  'bg-popover': 'var(--popover)',
  'bg-transparent': 'transparent',

  // Standard colors
  'bg-white': '#ffffff',
  'bg-black': '#000000',

  // Slate
  'bg-slate-50': '#f8fafc',
  'bg-slate-100': '#f1f5f9',
  'bg-slate-200': '#e2e8f0',
  'bg-slate-800': '#1e293b',
  'bg-slate-900': '#0f172a',
  'bg-slate-950': '#020617',

  // Cyan
  'bg-cyan-500': '#06b6d4',
  'bg-cyan-600': '#0891b2',
  'bg-cyan-700': '#0e7490',

  // Emerald
  'bg-emerald-500': '#10b981',
  'bg-emerald-600': '#059669',
  'bg-emerald-700': '#047857',

  // Amber
  'bg-amber-500': '#f59e0b',
  'bg-amber-600': '#d97706',
  'bg-amber-700': '#b45309',

  // Rose
  'bg-rose-500': '#f43f5e',
  'bg-rose-600': '#e11d48',
  'bg-rose-700': '#be123c',
};

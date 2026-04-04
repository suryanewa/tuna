/**
 * PropertyPanel — the right-side inspector panel showing
 * editable properties for the selected element.
 */

import { useState, useCallback, useRef, useEffect, useMemo, Fragment } from "react";
import type { InspectedElement } from "../types";
import type { BoxModelProperty } from "../ui/box-model-overlay";
import { Section, Row, RowGroup, Field } from "../ui/section";
import { NumberInput } from "../ui/number-input";
import type { VariableMatch } from "../variables/types";
import { resolveVariablesForElement, isRawUtility } from "../variables/resolver";
import { ComboInput, type ComboOption } from "../ui/combo-input";
import { ColorInput } from "../ui/color-input";
import { VariableAction } from "../ui/variable-action";
import { ChangeIndicator } from "../ui/change-indicator";
import { SelectInput } from "../ui/select-input";
import { DropdownMenu, type DropdownMenuOption } from "../ui/dropdown-menu";
import { SliderInput } from "../ui/slider-input";
import { TextInput } from "../ui/text-input";
import { FontInput } from "../ui/font-input";
import { ConstraintsInput, type PinState } from "../ui/constraints-input";
import { AlignmentGrid } from "../ui/alignment-grid";
import { GridPicker, parseGridCount } from "../ui/grid-picker";
import { GradientEditor } from "../ui/gradient-editor";
import { type FillMode, type GradientFill, detectFillMode, defaultGradient, parseCssGradient, gradientToCss } from "../ui/gradient-utils";
import { computeSizingChanges, detectSizingMode, canFill, type SizingMode } from "../ui/sizing-utils";
import { SegmentedControl } from "../ui/segmented-control";
import { detectTruncation, computeTruncationChanges } from "../ui/truncation-utils";
import type { SegmentedOption } from "../ui/segmented-control";
import {
  TextAlignLeft, TextAlignCenter, TextAlignRight,
  TextAlignTop, TextAlignMiddle, TextAlignBottom,
  LayoutAlignLeft, LayoutAlignRight, LayoutAlignHorizontalCenter,
  LayoutAlignTop, LayoutAlignBottom, LayoutAlignVerticalCenter,
  AlPaddingTop, AlPaddingBottom, AlPaddingLeft, AlPaddingRight,
  AlPaddingHorizontal, AlPaddingVertical, AlPaddingSides,
  AlSpacingHorizontal, AlSpacingVertical,
  RadiusTopLeft, RadiusTopRight, RadiusBottomLeft, RadiusBottomRight,
  RectangleSmall, AutolayoutAddHorizontal, AutolayoutAddVertical, GridView,
  Plus, Minus, AdjustSmall, ListView, NumberList, EyeSmall, HiddenSmall,
} from "../ui/icons";
import { Tooltip } from "../ui/tooltip";
import { ShorthandInput } from "../ui/shorthand-input";
import { parseBoxShadow, shadowToCss, defaultShadow, type ShadowValue } from "../ui/shadow-utils";
import {
  parseFilters, filtersToCss, defaultFilter,
  FILTER_TYPES, FILTER_CONFIG,
  type FilterItem, type FilterType, type FilterTarget,
} from "../ui/filter-utils";

/** Middle-truncate a string, preserving start and end for readability. */
function middleTruncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  const keep = maxLen - 1; // 1 char for ellipsis
  const start = Math.ceil(keep * 0.4);
  const end = Math.floor(keep * 0.6);
  return str.slice(0, start) + "\u2026" + str.slice(-end);
}


const TEXT_ALIGN_OPTIONS: SegmentedOption[] = [
  { value: "left", icon: <TextAlignLeft />, label: "Left" },
  { value: "center", icon: <TextAlignCenter />, label: "Center" },
  { value: "right", icon: <TextAlignRight />, label: "Right" },
];

const VERTICAL_ALIGN_OPTIONS: SegmentedOption[] = [
  { value: "top", icon: <TextAlignTop />, label: "Top" },
  { value: "middle", icon: <TextAlignMiddle />, label: "Middle" },
  { value: "bottom", icon: <TextAlignBottom />, label: "Bottom" },
];

/** Map computed textAlign CSS value to our option values */
function mapTextAlign(value: string | undefined): string {
  if (!value) return "left";
  if (value === "start") return "left";
  if (value === "end") return "right";
  return value; // left, center, right, justify pass through
}

/** Map computed verticalAlign CSS value to our option values */
function mapVerticalAlign(value: string | undefined): string {
  if (!value) return "top";
  if (value === "middle" || value === "center") return "middle";
  if (value === "bottom") return "bottom";
  if (value === "top" || value === "baseline" || value === "text-top") return "top";
  if (value === "text-bottom" || value === "sub") return "bottom";
  if (value === "super") return "top";
  return "top";
}

const SIZE_OPTIONS: ComboOption[] = [
  { value: "__fill", label: "Fill" },
  { value: "__hug", label: "Hug" },
  { value: "auto", label: "Auto" },
];


const FLEX_BASIS_OPTIONS: ComboOption[] = [
  { value: "auto", label: "Auto" },
  { value: "0", label: "0" },
  { value: "100%", label: "100%" },
  { value: "fit-content", label: "Fit Content" },
];

const FONT_WEIGHT_OPTIONS: ComboOption[] = [
  { value: "100", label: "Thin" },
  { value: "200", label: "Extra Light" },
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semibold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extra Bold" },
  { value: "900", label: "Black" },
];

const LINE_HEIGHT_OPTIONS: ComboOption[] = [
  { value: "normal", label: "Normal" },
  { value: "1", label: "1" },
  { value: "1.25", label: "1.25" },
  { value: "1.5", label: "1.5" },
  { value: "1.75", label: "1.75" },
  { value: "2", label: "2" },
];

const LETTER_SPACING_OPTIONS: ComboOption[] = [
  { value: "normal", label: "Normal" },
  { value: "-0.05em", label: "Tight" },
  { value: "0.05em", label: "Wide" },
  { value: "0.1em", label: "Wider" },
];




type SizeExtra = "min" | "max";

const DISPLAY_OPTIONS: SegmentedOption[] = [
  { value: "block", icon: <RectangleSmall />, label: "Block" },
  { value: "flex-row", icon: <AutolayoutAddHorizontal />, label: "Flex →" },
  { value: "flex-column", icon: <AutolayoutAddVertical />, label: "Flex ↓" },
  { value: "grid", icon: <GridView />, label: "Grid" },
];

const LIST_STYLE_OPTIONS: SegmentedOption[] = [
  { value: "none", icon: <Minus />, label: "None" },
  { value: "disc", icon: <ListView />, label: "Bullet" },
  { value: "decimal", icon: <NumberList />, label: "Numbered" },
];

type ForcedState = ":hover" | ":focus" | ":active" | null;

type SelectorCandidate = { selector: string; count: number; verdict: "semantic" | "utility" | "ambiguous" };
type ScopeLevel = { label: string; selector: string | null; count: number; kind?: string };
type StyleSource = { selector: string; value: string };

export function PropertyPanel({
  element,
  position,
  onPropertyChange,
  onPropertyHover,
  onApplyToElement,
  onVariableSwap,
  onVariableAssociate,
  onVariableUnlink,
  variableAssociations = {},
  unlinkedVariables,
  changedProperties,
  onPropertyReset,
  selectorCandidates = [],
  activeSelector = null,
  scopeLevels = [] as ScopeLevel[],
  activeLevelIndex = 0,
  onScopeLevelChange,
  onScopeLevelHover,
  ownedProperties,
  styleSources = {},
  forcedState = null,
  onForcedStateChange,
  onPinLinesChange,
}: {
  element: InspectedElement;
  position: "left" | "right";
  onPropertyChange: (property: string, value: string) => void;
  onPropertyHover?: (property: BoxModelProperty) => void;
  onApplyToElement?: (element: Element, property: string, value: string) => void;
  onVariableSwap?: (oldClassName: string, newClassName: string) => void;
  /** Record a value-only token association (persisted in change tracker) */
  onVariableAssociate?: (properties: string[], token: { className: string; values: Record<string, string> }) => void;
  /** Clear token association for properties */
  onVariableUnlink?: (properties: string[]) => void;
  /** Current value-only token associations from change tracker */
  variableAssociations?: Record<string, { className: string; values: Record<string, string> }>;
  /** Properties explicitly unlinked from their token */
  unlinkedVariables?: Set<string>;
  /** Properties that have been changed from their original value */
  changedProperties?: Set<string>;
  /** Reset a single property to its original value */
  onPropertyReset?: (property: string) => void;
  selectorCandidates?: SelectorCandidate[];
  activeSelector?: string | null;
  scopeLevels?: ScopeLevel[];
  activeLevelIndex?: number;
  onScopeLevelChange?: (index: number) => void;
  onScopeLevelHover?: (index: number | null) => void;
  /** Properties owned by CSS rules matching the active scope. undefined = show all. */
  ownedProperties?: Set<string>;
  styleSources?: Record<string, StyleSource>;
  forcedState?: ForcedState;
  onForcedStateChange?: (state: ForcedState) => void;
  onPinLinesChange?: (authored: { top: boolean; right: boolean; bottom: boolean; left: boolean }) => void;
}) {
  const rawStyles = element.computedStyles;

  // Scope-aware styles: getScopedStyles already returns scoped values for owned
  // properties and computed values for the rest. No Proxy needed.
  const s = rawStyles;

  // ── Token resolution ──
  const variableMatches = useMemo(() => {
    if (!element.element) return new Map<string, VariableMatch>();
    return resolveVariablesForElement(element.element, s, activeSelector ?? undefined);
  }, [element.element, s, activeSelector]);

  // Helper: get token match for a camelCase prop.
  // User-set associations take priority over element-scanned matches, since the
  // user explicitly chose a token (e.g., swapping var(--spacing-4) → var(--spacing-8)).
  const getVariableMatch = useCallback((camelProp: string): VariableMatch | undefined => {
    // Skip properties that the user explicitly unlinked
    if (unlinkedVariables?.has(camelProp)) return undefined;
    const kebab = camelProp.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
    // Check persisted associations first (user's explicit choice takes priority)
    const assoc = variableAssociations[camelProp];
    if (assoc) return { variable: assoc, property: kebab };
    // Then element-scanned matches (class-based + CSS variable detection)
    const match = variableMatches.get(kebab);
    if (match && !isRawUtility(match.variable)) return match;
    return undefined;
  }, [variableMatches, variableAssociations, unlinkedVariables]);

  // Handle token swap: swap classes on the element.
  // If the old token's class is on the element, do a class swap.
  // If not (value-only apply), just update values without touching classes.
  // `fallbackProperties` provides the affected CSS properties when the token was
  // auto-detected from stylesheets (no entry in variableAssociations).
  const handleVariableSelect = useCallback((oldToken: import("../variables/types").DesignVariable, newToken: import("../variables/types").DesignVariable, fallbackProperties?: string[]) => {
    const el = element.element;
    if (!el) return;
    const isClassBased = el.classList.contains(oldToken.className);
    const newIsVariable = newToken.className.startsWith("var(");
    if (isClassBased && !newIsVariable) {
      // Class-based swap (both old and new are class tokens)
      el.classList.remove(oldToken.className);
      el.classList.add(newToken.className);
      onVariableSwap?.(oldToken.className, newToken.className);
      for (const [prop, val] of Object.entries(newToken.values)) {
        const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        onPropertyChange(camelProp, val);
      }
    } else {
      // Value-only swap: find which properties had the old token applied
      const affectedProps: string[] = [];
      for (const [prop, ref] of Object.entries(variableAssociations)) {
        if (ref.className === oldToken.className) {
          affectedProps.push(prop);
        }
      }
      // Fallback for element-scanned tokens (detected from stylesheets, no explicit association)
      if (affectedProps.length === 0 && fallbackProperties) {
        affectedProps.push(...fallbackProperties);
      }
      const value = Object.values(newToken.values)[0];
      if (!value) return;
      for (const prop of affectedProps) {
        onPropertyChange(prop, value);
      }
      onVariableAssociate?.(affectedProps, { className: newToken.className, values: newToken.values });
    }
  }, [element.element, onVariableSwap, onPropertyChange, variableAssociations, onVariableAssociate]);

  // Handle applying a token value from scratch (no existing token on element).
  // This is a value pick — we set the token's representative value on the specific
  // properties being edited, without adding the class. This lets the user apply
  // different tokens to different sides (e.g. different H and V padding).
  const handleVariableApply = useCallback((newToken: import("../variables/types").DesignVariable, properties: string[]) => {
    const el = element.element;
    if (!el) return;
    const value = Object.values(newToken.values)[0];
    if (!value) return;
    for (const prop of properties) {
      onPropertyChange(prop, value);
    }
    onVariableAssociate?.(properties, { className: newToken.className, values: newToken.values });
  }, [element.element, onPropertyChange, onVariableAssociate]);

  // Handle unlinking a token from a property (clears association without changing value)
  const handleVariableUnlink = useCallback((camelProp: string) => {
    onVariableUnlink?.([camelProp]);
  }, [onVariableUnlink]);

  // Token props for a NumberInput
  const variableProps = useCallback((camelProp: string) => {
    const match = getVariableMatch(camelProp);
    return {
      ...(match ? { variableMatch: match, onVariableSelect: handleVariableSelect, onVariableUnlink: () => handleVariableUnlink(camelProp) } : {}),
      property: camelProp,
      onVariableApply: handleVariableApply,
    };
  }, [getVariableMatch, handleVariableSelect, handleVariableApply, handleVariableUnlink]);

  // Token props for ShorthandInput — only shows variable indicator when ALL props share the same variable
  const shorthandVariableProps = useCallback((camelProps: string[]) => {
    const allMatches = camelProps.map(p => getVariableMatch(p));
    const firstMatch = allMatches.find(m => m !== undefined);
    if (!firstMatch) return { property: camelProps[0], onVariableApply: handleVariableApply };

    // Only show as variable-applied when ALL properties share the same variable
    const allSameVar = allMatches.every(
      m => m !== undefined && m.variable.className === firstMatch.variable.className
    );
    if (allSameVar) {
      return {
        variableMatch: firstMatch, property: camelProps[0],
        onVariableSelect: handleVariableSelect, onVariableApply: handleVariableApply,
        onVariableUnlink: () => onVariableUnlink?.(camelProps),
      };
    }
    return { property: camelProps[0], onVariableApply: handleVariableApply };
  }, [getVariableMatch, handleVariableSelect, handleVariableApply, onVariableUnlink]);

  // Change indicator props for a single property
  const changeProps = useCallback((camelProp: string) => ({
    isChanged: changedProperties?.has(camelProp) ?? false,
    onReset: () => onPropertyReset?.(camelProp),
  }), [changedProperties, onPropertyReset]);

  // Change indicator props for shorthand groups: changed if ANY property in the group changed
  const shorthandChangeProps = useCallback((camelProps: string[]) => ({
    isChanged: camelProps.some(p => changedProperties?.has(p)) ?? false,
    onReset: () => { for (const p of camelProps) onPropertyReset?.(p); },
  }), [changedProperties, onPropertyReset]);

  const TEXT_TAGS = ["P", "H1", "H2", "H3", "H4", "H5", "H6", "SPAN", "A", "BUTTON", "LABEL", "LI", "TD", "TH", "FIGCAPTION", "BLOCKQUOTE", "CITE", "EM", "STRONG", "SMALL"];
  const hasDirectText = element.element ? Array.from(element.element.childNodes).some(
    (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()
  ) : false;
  const isText = TEXT_TAGS.includes(element.tagName) || hasDirectText;
  const displayValue = s.display || "block";
  const isFlex = displayValue.includes("flex");
  const isGrid = displayValue.includes("grid");
  const positionType = s.position || "static";
  const isPositioned = positionType !== "static";
  const showOffsets = positionType === "absolute" || positionType === "fixed" || positionType === "relative";
  const isSticky = positionType === "sticky";
  const hasVerticalAlign = isText || ["IMG", "INPUT", "SELECT", "TEXTAREA"].includes(element.tagName) || isFlex || isGrid;
  const isImage = element.tagName === "IMG" || element.tagName === "PICTURE" || element.tagName === "CANVAS";
  const isVideo = element.tagName === "VIDEO";
  const isSvg = element.tagName === "SVG" || element.tagName === "svg";
  const isSvgChild = !isSvg && !!element.element?.closest("svg");
  const isMedia = isImage || isVideo;
  const hasBackgroundImage = s.backgroundImage && s.backgroundImage !== "none" && !s.backgroundImage.startsWith("linear-gradient") && !s.backgroundImage.startsWith("radial-gradient");

  // Detect if element is a child of a flex/grid container
  const parentDisplay = element.element?.parentElement
    ? getComputedStyle(element.element.parentElement).display
    : "";
  const isFlexChild = parentDisplay.includes("flex");
  const isGridChild = parentDisplay.includes("grid");

  // Parent flex direction (for sizing mode)
  const parentFlexDir = isFlexChild && element.element?.parentElement
    ? getComputedStyle(element.element.parentElement).flexDirection || "row"
    : "row";

  // Shadow state
  const hasShadow = s.boxShadow && s.boxShadow !== "none";

  // Filter state — use a ref to skip re-sync when we're the source of the change
  const filterSelfUpdate = useRef(false);
  const [filters, setFilters] = useState<FilterItem[]>(() => parseFilters(s.filter, s.backdropFilter));
  const [prevFilter, setPrevFilter] = useState(s.filter);
  const [prevBackdropFilter, setPrevBackdropFilter] = useState(s.backdropFilter);
  if (s.filter !== prevFilter || s.backdropFilter !== prevBackdropFilter) {
    setPrevFilter(s.filter);
    setPrevBackdropFilter(s.backdropFilter);
    if (filterSelfUpdate.current) {
      filterSelfUpdate.current = false;
    } else {
      setFilters(parseFilters(s.filter, s.backdropFilter));
    }
  }
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [filterMenuPos, setFilterMenuPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const filterMenuBtnRef = useRef<HTMLButtonElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const filterSectionRef = useRef<HTMLDivElement>(null);

  // Progressive disclosure states
  const [paddingExpanded, setPaddingExpanded] = useState(false);
  const [marginExpanded, setMarginExpanded] = useState(false);
  const [radiusExpanded, setRadiusExpanded] = useState(false);
  const [typoExpanded, setTypoExpanded] = useState(false);
  const [sizeExtras, setSizeExtras] = useState<Set<SizeExtra>>(new Set());
  const [aspectLocked, setAspectLocked] = useState(false);
  const aspectRatioRef = useRef<number>(1); // width / height ratio, captured when lock is toggled
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  const [sizeMenuPos, setSizeMenuPos] = useState<{ top: number; left: number } | null>(null);

  // Close size dropdown on outside click
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const sizeMenuBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!sizeMenuOpen) return;
    const handleClick = (e: PointerEvent) => {
      const btn = sizeMenuBtnRef.current;
      const menu = sizeMenuRef.current;
      if (btn && btn.contains(e.target as Node)) return;
      if (menu && menu.contains(e.target as Node)) return;
      setSizeMenuOpen(false);
    };
    const root = sizeMenuBtnRef.current?.getRootNode() as ShadowRoot | Document;
    root.addEventListener("pointerdown", handleClick as EventListener);
    return () => root.removeEventListener("pointerdown", handleClick as EventListener);
  }, [sizeMenuOpen]);

  // Close filter menu on outside click
  useEffect(() => {
    if (!filterMenuOpen) return;
    const handleClick = (e: PointerEvent) => {
      const btn = filterMenuBtnRef.current;
      const menu = filterMenuRef.current;
      if (btn && btn.contains(e.target as Node)) return;
      if (menu && menu.contains(e.target as Node)) return;
      setFilterMenuOpen(false);
    };
    const root = filterMenuBtnRef.current?.getRootNode() as ShadowRoot | Document;
    root.addEventListener("pointerdown", handleClick as EventListener);
    return () => root.removeEventListener("pointerdown", handleClick as EventListener);
  }, [filterMenuOpen]);

  // Detect semantic sizing mode for width/height display
  const sizingCtx = { isFlexChild, isGridChild, parentFlexDir, currentStyles: s };
  const widthMode = detectSizingMode("width", sizingCtx);
  const heightMode = detectSizingMode("height", sizingCtx);
  const heightCanFill = canFill("height", sizingCtx);
  const heightSizeOptions = heightCanFill ? SIZE_OPTIONS : SIZE_OPTIONS.filter(o => o.value !== "__fill");
  // Map semantic mode to the __fill/__hug pseudo-values for ComboInput display
  const widthDisplayValue = widthMode === "fill" ? "__fill" : widthMode === "hug" ? "__hug" : s.width;
  const heightDisplayValue = heightMode === "fill" ? "__fill" : heightMode === "hug" ? "__hug" : s.height;

  // Auto-show size extras that have non-default values
  const visibleSizeExtras = new Set(sizeExtras);
  if ((s.minWidth && s.minWidth !== "0px" && s.minWidth !== "auto") ||
      (s.minHeight && s.minHeight !== "0px" && s.minHeight !== "auto")) visibleSizeExtras.add("min");
  if ((s.maxWidth && s.maxWidth !== "none") ||
      (s.maxHeight && s.maxHeight !== "none")) visibleSizeExtras.add("max");

  // Detect which position properties are authored for pin state
  const [pins, setPins] = useState<PinState>(() => {
    const el = element.element as HTMLElement;
    const cs = element.computedStyles;
    const pos = cs.position;
    if (pos !== "absolute" && pos !== "fixed") return { top: true, right: false, bottom: false, left: true };

    function isAuthored(prop: "top" | "right" | "bottom" | "left"): boolean {
      // Check inline style first
      if (el.style[prop] !== "") return true;
      // Check matched CSS rules
      try {
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule instanceof CSSStyleRule && el.matches(rule.selectorText)) {
                const val = rule.style.getPropertyValue(prop);
                if (val && val !== "auto") return true;
              }
            }
          } catch {}
        }
      } catch {}
      return false;
    }

    const hasTop = isAuthored("top");
    const hasBottom = isAuthored("bottom");
    const hasLeft = isAuthored("left");
    const hasRight = isAuthored("right");

    return {
      top: hasTop || (!hasTop && !hasBottom),
      right: hasRight && !hasLeft,
      bottom: hasBottom && !hasTop,
      left: hasLeft || (!hasLeft && !hasRight),
    };
  });
  const [centered, setCentered] = useState(false);
  const centeredAxes = useRef({ h: false, v: false });

  // ── Fill mode (solid vs gradient) ──
  const detectedFillMode = detectFillMode(s.backgroundColor, s.backgroundImage);
  const [fillMode, setFillMode] = useState<FillMode>(detectedFillMode);
  // Capture the ORIGINAL fill mode and gradient at mount time (for change tracking)
  const [initialFillMode] = useState<FillMode>(detectedFillMode);
  const [initialGradient] = useState<GradientFill | null>(() => {
    if (s.backgroundImage && s.backgroundImage !== "none") {
      return parseCssGradient(s.backgroundImage) ?? null;
    }
    return null;
  });
  const [gradient, setGradient] = useState<GradientFill>(() => {
    if (s.backgroundImage && s.backgroundImage !== "none") {
      const parsed = parseCssGradient(s.backgroundImage);
      if (parsed) return parsed;
    }
    return defaultGradient();
  });
  // Skip gradient sync when we're the source of the change (e.g. during stop drag)
  const gradientEditingRef = useRef(false);

  // Sync fill mode from element changes
  const [prevBgImage, setPrevBgImage] = useState(s.backgroundImage);
  if (s.backgroundImage !== prevBgImage) {
    setPrevBgImage(s.backgroundImage);
    if (!gradientEditingRef.current) {
      const newMode = detectFillMode(s.backgroundColor, s.backgroundImage);
      setFillMode(newMode);
      if (newMode !== "solid") {
        const parsed = parseCssGradient(s.backgroundImage || "");
        if (parsed) setGradient(parsed);
      }
    }
    gradientEditingRef.current = false;
  }

  // ── Fill (null-or-active) ──
  const hasFill = (() => {
    const bg = s.backgroundColor;
    const bgImg = s.backgroundImage;
    if (bgImg && bgImg !== "none") return true;
    if (!bg || bg === "transparent" || bg === "rgba(0, 0, 0, 0)") return false;
    return true;
  })();

  const handleAddFill = useCallback(() => {
    onPropertyChange("backgroundColor", "#ffffff");
  }, [onPropertyChange]);

  const handleRemoveFill = useCallback(() => {
    onPropertyChange("backgroundColor", "transparent");
    onPropertyChange("backgroundImage", "none");
    setFillMode("solid");
  }, [onPropertyChange]);

  // ── Border (null-or-active) ──
  const borderSides = [
    { width: s.borderTopWidth, style: s.borderTopStyle },
    { width: s.borderRightWidth, style: s.borderRightStyle },
    { width: s.borderBottomWidth, style: s.borderBottomStyle },
    { width: s.borderLeftWidth, style: s.borderLeftStyle },
  ];
  const hasBorder = borderSides.some((side) => side.style !== "none" && parseFloat(side.width) > 0);
  const borderIsUniform = hasBorder &&
    new Set(borderSides.map((b) => `${b.width}|${b.style}`)).size === 1 &&
    new Set([s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor]).size === 1;
  const borderColors = [s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor];
  const activeBorderColor = borderSides.reduce<string | null>((found, side, i) => {
    if (found) return found;
    return (side.style !== "none" && parseFloat(side.width) > 0) ? borderColors[i] : null;
  }, null) || s.borderTopColor;
  const [borderExpanded, setBorderExpanded] = useState(false);

  const handleAddBorder = useCallback(() => {
    onPropertyChange("borderWidth", "1px");
    onPropertyChange("borderStyle", "solid");
    onPropertyChange("borderColor", "#000000");
  }, [onPropertyChange]);

  const handleRemoveBorder = useCallback(() => {
    onPropertyChange("borderTopWidth", "0px");
    onPropertyChange("borderRightWidth", "0px");
    onPropertyChange("borderBottomWidth", "0px");
    onPropertyChange("borderLeftWidth", "0px");
    onPropertyChange("borderTopStyle", "none");
    onPropertyChange("borderRightStyle", "none");
    onPropertyChange("borderBottomStyle", "none");
    onPropertyChange("borderLeftStyle", "none");
  }, [onPropertyChange]);

  const handleFillModeChange = useCallback((prop: string, value: string) => {
    const mode = value as FillMode;
    setFillMode(mode);
    if (mode === "solid") {
      onPropertyChange("backgroundImage", "none");
      onPropertyChange("backgroundColor", "#ffffff");
    } else {
      const newGradient = { ...gradient, type: mode as GradientFill["type"] };
      setGradient(newGradient);
      onPropertyChange("backgroundImage", gradientToCss(newGradient));
      onPropertyChange("backgroundColor", "transparent");
    }
  }, [gradient, onPropertyChange]);

  const handleGradientChange = useCallback((newGradient: GradientFill) => {
    gradientEditingRef.current = true;
    setGradient(newGradient);
    onPropertyChange("backgroundImage", gradientToCss(newGradient));
  }, [onPropertyChange]);

  const handleSizingModeChange = useCallback((axis: "width" | "height", mode: SizingMode) => {
    const rect = element.element?.getBoundingClientRect();
    const changes = computeSizingChanges(axis, mode, {
      isFlexChild,
      isGridChild,
      parentFlexDir,
      currentStyles: s,
      elementRect: rect ? { width: rect.width, height: rect.height } : undefined,
    });
    for (const [prop, value] of Object.entries(changes)) {
      onPropertyChange(prop, value);
    }
  }, [isFlexChild, isGridChild, parentFlexDir, s, element.element, onPropertyChange]);

  const handleAddShadow = useCallback(() => {
    onPropertyChange("boxShadow", shadowToCss(defaultShadow()));
  }, [onPropertyChange]);

  const handleRemoveShadow = useCallback(() => {
    onPropertyChange("boxShadow", "none");
  }, [onPropertyChange]);

  const handleShadowFieldChange = useCallback((field: keyof ShadowValue, value: string | number | boolean) => {
    const parsed = parseBoxShadow(s.boxShadow) || defaultShadow();
    const updated = { ...parsed, [field]: value };
    onPropertyChange("boxShadow", shadowToCss(updated));
  }, [s.boxShadow, onPropertyChange]);

  const applyFilters = useCallback((updated: FilterItem[]) => {
    filterSelfUpdate.current = true;
    setFilters(updated);
    const css = filtersToCss(updated);
    onPropertyChange("filter", css.filter);
    onPropertyChange("backdropFilter", css.backdropFilter);
  }, [onPropertyChange]);

  const handleAddFilter = useCallback((type: FilterType, target: FilterTarget) => {
    applyFilters([...filters, defaultFilter(type, target)]);
    setFilterMenuOpen(false);
    requestAnimationFrame(() => {
      filterSectionRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    });
  }, [filters, applyFilters]);

  const handleRemoveFilter = useCallback((id: string) => {
    applyFilters(filters.filter((f) => f.id !== id));
  }, [filters, applyFilters]);

  const handleFilterValueChange = useCallback((id: string, value: number) => {
    applyFilters(filters.map((f) => f.id === id ? { ...f, value } : f));
  }, [filters, applyFilters]);

  const handlePinChange = useCallback((side: "top" | "right" | "bottom" | "left", pinned: boolean) => {
    setPins((prev) => {
      const next = { ...prev, [side]: pinned };
      onPinLinesChange?.(next);
      return next;
    });
  }, [onPinLinesChange]);

  const applyTransform = useCallback(() => {
    const { h, v } = centeredAxes.current;
    if (h && v) {
      setCentered(true);
      onPropertyChange("transform", "translate(-50%, -50%)");
    } else {
      setCentered(false);
      if (h) {
        onPropertyChange("transform", "translateX(-50%)");
      } else if (v) {
        onPropertyChange("transform", "translateY(-50%)");
      } else {
        onPropertyChange("transform", "none");
      }
    }
  }, [onPropertyChange]);

  const alignLeft = useCallback(() => {
    setPins((p) => ({ ...p, left: true, right: false }));
    centeredAxes.current.h = false;
    onPropertyChange("left", "0px");
    onPropertyChange("right", "auto");
    applyTransform();
  }, [onPropertyChange, applyTransform]);

  const alignCenterH = useCallback(() => {
    setPins((p) => ({ ...p, left: true, right: false }));
    centeredAxes.current.h = true;
    onPropertyChange("left", "50%");
    onPropertyChange("right", "auto");
    applyTransform();
  }, [onPropertyChange, applyTransform]);

  const alignRight = useCallback(() => {
    setPins((p) => ({ ...p, right: true, left: false }));
    centeredAxes.current.h = false;
    onPropertyChange("right", "0px");
    onPropertyChange("left", "auto");
    applyTransform();
  }, [onPropertyChange, applyTransform]);

  const alignTop = useCallback(() => {
    setPins((p) => ({ ...p, top: true, bottom: false }));
    centeredAxes.current.v = false;
    onPropertyChange("top", "0px");
    onPropertyChange("bottom", "auto");
    applyTransform();
  }, [onPropertyChange, applyTransform]);

  const alignCenterV = useCallback(() => {
    setPins((p) => ({ ...p, top: true, bottom: false }));
    centeredAxes.current.v = true;
    onPropertyChange("top", "50%");
    onPropertyChange("bottom", "auto");
    applyTransform();
  }, [onPropertyChange, applyTransform]);

  const alignBottom = useCallback(() => {
    setPins((p) => ({ ...p, bottom: true, top: false }));
    centeredAxes.current.v = false;
    onPropertyChange("bottom", "0px");
    onPropertyChange("top", "auto");
    applyTransform();
  }, [onPropertyChange, applyTransform]);

  return (
    <>
      {/* Element */}
      <Section label={element.reactComponents?.[0] ? "Scope" : element.tagName.toLowerCase()}>
        {scopeLevels.length > 1 && onScopeLevelChange && (() => {
          const prevLevelRef = useRef(activeLevelIndex);
          const fieldRef = useRef<HTMLDivElement>(null);

          const computeBridgesForLevel = (level: number) => {
            if (scopeLevels[level]?.selector === null) return new Set<number>(); // "This element" — no bridges
            const bridges = new Set<number>();
            for (let i = 0; i < scopeLevels.length - 1; i++) {
              const cur = scopeLevels[i];
              const nxt = scopeLevels[i + 1];
              if (cur.selector !== null && nxt && nxt.selector !== null && i < level && (i + 1) <= level) {
                bridges.add(i);
              }
            }
            return bridges;
          };
          const [bridgeVisible, setBridgeVisible] = useState<Set<number>>(() => computeBridgesForLevel(activeLevelIndex));

          // Capture pill colors after paint for the NEXT transition
          const pillColorsRef = useRef<Map<number, { bg: string; color: string }>>(new Map());
          useEffect(() => {
            const f = fieldRef.current;
            if (!f) return;
            const colors = new Map<number, { bg: string; color: string }>();
            f.querySelectorAll<HTMLElement>('[data-level-index]').forEach(pill => {
              const idx = parseInt(pill.dataset.levelIndex || '0', 10);
              const style = getComputedStyle(pill);
              colors.set(idx, { bg: style.backgroundColor, color: style.color });
            });
            pillColorsRef.current = colors;
          });

          // Animate on level change
          useEffect(() => {
            const prev = prevLevelRef.current;
            prevLevelRef.current = activeLevelIndex;
            if (prev === activeLevelIndex) return;

            const oldBridges = computeBridgesForLevel(prev);
            const newBridges = computeBridgesForLevel(activeLevelIndex);

            const appearing: number[] = [];
            const disappearing: number[] = [];
            newBridges.forEach(b => { if (!oldBridges.has(b)) appearing.push(b); });
            oldBridges.forEach(b => { if (!newBridges.has(b)) disappearing.push(b); });

            if (appearing.length === 0 && disappearing.length === 0) {
              setBridgeVisible(newBridges);
              return;
            }

            const field = fieldRef.current;
            if (!field) { setBridgeVisible(newBridges); return; }

            const DURATION = 320;
            const EASING = 'cubic-bezier(0.77, 0, 0.175, 1)';
            const EXTEND = 6;
            const getPill = (idx: number) => field.querySelector<HTMLElement>(`[data-level-index="${idx}"]`);

            const allBridges = [...appearing, ...disappearing];
            const pillSides = new Map<number, Set<'left' | 'right'>>();
            for (const bridgeIdx of allBridges) {
              if (!pillSides.has(bridgeIdx)) pillSides.set(bridgeIdx, new Set());
              pillSides.get(bridgeIdx)!.add('right');
              if (!pillSides.has(bridgeIdx + 1)) pillSides.set(bridgeIdx + 1, new Set());
              pillSides.get(bridgeIdx + 1)!.add('left');
            }

            // Freeze pill colors to pre-change appearance
            const snapshotColors = pillColorsRef.current;
            const frozenPills: HTMLElement[] = [];
            for (const [pillIdx] of pillSides) {
              const pill = getPill(pillIdx);
              if (!pill) continue;
              const old = snapshotColors.get(pillIdx);
              if (old) {
                pill.style.backgroundColor = old.bg;
                pill.style.color = old.color;
                frozenPills.push(pill);
              }
            }

            // Animate box-shadow + border-radius
            for (const [pillIdx, sides] of pillSides) {
              const pill = getPill(pillIdx);
              if (!pill) continue;
              const bg = snapshotColors.get(pillIdx)?.bg || '#f5f5f4';

              const shadows: string[] = [];
              if (sides.has('right')) shadows.push(`${EXTEND}px 0 0 0 ${bg}`);
              if (sides.has('left')) shadows.push(`-${EXTEND}px 0 0 0 ${bg}`);
              const peakShadow = shadows.join(', ');
              const zeroShadows = shadows.map(() => `0px 0 0 0 ${bg}`).join(', ');

              const R = '8px';
              const Z = '0px';
              const peakRadius = `${sides.has('left') ? Z : R} ${sides.has('right') ? Z : R} ${sides.has('right') ? Z : R} ${sides.has('left') ? Z : R}`;

              pill.animate([
                { boxShadow: zeroShadows, borderRadius: `${R} ${R} ${R} ${R}` },
                { boxShadow: peakShadow, borderRadius: peakRadius },
                { boxShadow: zeroShadows, borderRadius: `${R} ${R} ${R} ${R}` },
              ], { duration: DURATION, easing: EASING });
            }

            // Midpoint: unfreeze colors + update bridges
            const timer = setTimeout(() => {
              for (const pill of frozenPills) {
                pill.style.removeProperty('background-color');
                pill.style.removeProperty('color');
              }
              setBridgeVisible(newBridges);
            }, DURATION / 2);

            // Cleanup: cancel stale timeout if level changes again before animation finishes
            return () => clearTimeout(timer);
          }, [activeLevelIndex, scopeLevels]);

          return (
            <RowGroup label="Target">
              <div className="retune-selector-field" ref={fieldRef}>
                {scopeLevels.map((level, index) => {
                  const isActive = index === activeLevelIndex;
                  const isElementLevel = level.selector === null;
                  const activeIsElementLevel = scopeLevels[activeLevelIndex]?.selector === null;
                  const isIncluded = index < activeLevelIndex && !activeIsElementLevel;
                  const showBridge = bridgeVisible.has(index);
                  return (
                    <Fragment key={level.selector ?? "__element"}>
                      {isElementLevel && scopeLevels.length > 1 && (
                        <span className="retune-selector-divider" />
                      )}
                      <button
                        className={`retune-selector-tag${isActive ? " active" : ""}${isIncluded ? " included" : ""}`}
                        data-level-index={index}
                        onClick={() => onScopeLevelChange(index)}
                        onPointerEnter={() => onScopeLevelHover?.(index)}
                        onPointerLeave={() => onScopeLevelHover?.(null)}
                      >
                        {level.label.length > 24 ? (
                          <Tooltip content={level.label} side="bottom" delay={300}>
                            <span className="retune-selector-tag-name">
                              {middleTruncate(level.label, 24)}
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="retune-selector-tag-name">
                            {level.label}
                          </span>
                        )}
                        {level.count > 1 && (
                          <Tooltip content={`${level.count} elements match this selector`} side="bottom" delay={300}>
                            <span className="retune-selector-tag-count">{level.count}</span>
                          </Tooltip>
                        )}
                      </button>
                      {showBridge && (
                        <span className="retune-selector-bridge filled" />
                      )}
                    </Fragment>
                  );
                })}
              </div>
            </RowGroup>
          );
        })()}
        {onForcedStateChange && (
          <RowGroup label="Trigger">
            <div className="retune-row">
              <SelectInput
                prop="__state"
                value={forcedState ? ({ ":hover": "Hover", ":focus": "Focus", ":active": "Active" } as Record<string, string>)[forcedState] ?? "None" : "None"}
                options={["None", "Hover", "Focus", "Active"]}
                onChange={(_, val) => {
                  const map: Record<string, string | null> = { None: null, Hover: ":hover", Focus: ":focus", Active: ":active" };
                  onForcedStateChange(map[val] as ForcedState | null);
                }}
              />
            </div>
          </RowGroup>
        )}
      </Section>

      {/* Position (hidden for SVG child shapes) */}
      {!isSvgChild && <Section label="Position">
        {/* Unified alignment row — always visible, disabled when not applicable */}
        {(() => {
          const isAbsoluteOrFixed = positionType === "absolute" || positionType === "fixed";
          const isFlexColumn = isFlexChild && parentFlexDir.startsWith("column");
          const isFlexRow = isFlexChild && !parentFlexDir.startsWith("column");

          // Horizontal group: absolute/fixed, grid child, or flex-column child (cross axis)
          const hEnabled = isAbsoluteOrFixed || isGridChild || isFlexColumn;
          // Vertical group: absolute/fixed, grid child, or flex-row child (cross axis)
          const vEnabled = isAbsoluteOrFixed || isGridChild || isFlexRow;

          // Current align-self / justify-self for active state detection
          const alignSelf = s.alignSelf || "auto";
          const justifySelf = s.justifySelf || "auto";

          // Determine which alignment is active for each axis
          const getHActive = (): "start" | "center" | "end" | null => {
            if (isFlexColumn) {
              if (alignSelf === "flex-start" || alignSelf === "start") return "start";
              if (alignSelf === "center") return "center";
              if (alignSelf === "flex-end" || alignSelf === "end") return "end";
            } else if (isGridChild) {
              if (justifySelf === "start") return "start";
              if (justifySelf === "center") return "center";
              if (justifySelf === "end") return "end";
            }
            return null;
          };
          const getVActive = (): "start" | "center" | "end" | null => {
            if (isFlexRow) {
              if (alignSelf === "flex-start" || alignSelf === "start") return "start";
              if (alignSelf === "center") return "center";
              if (alignSelf === "flex-end" || alignSelf === "end") return "end";
            } else if (isGridChild) {
              if (alignSelf === "start") return "start";
              if (alignSelf === "center") return "center";
              if (alignSelf === "end") return "end";
            }
            return null;
          };
          const hActive = getHActive();
          const vActive = getVActive();

          const onHClick = (alignment: "start" | "center" | "end") => {
            if (isAbsoluteOrFixed) {
              if (alignment === "start") alignLeft();
              else if (alignment === "center") alignCenterH();
              else alignRight();
            } else if (isGridChild) {
              // Toggle: click active alignment to reset
              onPropertyChange("justifySelf", hActive === alignment ? "auto" : alignment);
            } else if (isFlexColumn) {
              const flexVal = alignment === "start" ? "flex-start" : alignment === "end" ? "flex-end" : "center";
              onPropertyChange("alignSelf", hActive === alignment ? "auto" : flexVal);
            }
          };

          const onVClick = (alignment: "start" | "center" | "end") => {
            if (isAbsoluteOrFixed) {
              if (alignment === "start") alignTop();
              else if (alignment === "center") alignCenterV();
              else alignBottom();
            } else if (isGridChild) {
              onPropertyChange("alignSelf", vActive === alignment ? "auto" : alignment);
            } else if (isFlexRow) {
              const flexVal = alignment === "start" ? "flex-start" : alignment === "end" ? "flex-end" : "center";
              onPropertyChange("alignSelf", vActive === alignment ? "auto" : flexVal);
            }
          };

          return (
            <Row>
              <div className="retune-field">
                <span className="retune-field-label">Alignment</span>
                <div className="retune-align-row">
                  <div className="retune-btn-group" style={!hEnabled ? { opacity: 0.3, pointerEvents: "none" } : undefined}>
                    <Tooltip content="Align left" side="top"><button type="button" className={`retune-align-btn${hActive === "start" ? " active" : ""}`} onClick={() => onHClick("start")}><LayoutAlignLeft /></button></Tooltip>
                    <Tooltip content="Align center horizontally" side="top"><button type="button" className={`retune-align-btn${hActive === "center" ? " active" : ""}`} onClick={() => onHClick("center")}><LayoutAlignHorizontalCenter /></button></Tooltip>
                    <Tooltip content="Align right" side="top"><button type="button" className={`retune-align-btn${hActive === "end" ? " active" : ""}`} onClick={() => onHClick("end")}><LayoutAlignRight /></button></Tooltip>
                  </div>
                  <div className="retune-btn-group" style={!vEnabled ? { opacity: 0.3, pointerEvents: "none" } : undefined}>
                    <Tooltip content="Align top" side="top"><button type="button" className={`retune-align-btn${vActive === "start" ? " active" : ""}`} onClick={() => onVClick("start")}><LayoutAlignTop /></button></Tooltip>
                    <Tooltip content="Align center vertically" side="top"><button type="button" className={`retune-align-btn${vActive === "center" ? " active" : ""}`} onClick={() => onVClick("center")}><LayoutAlignVerticalCenter /></button></Tooltip>
                    <Tooltip content="Align bottom" side="top"><button type="button" className={`retune-align-btn${vActive === "end" ? " active" : ""}`} onClick={() => onVClick("end")}><LayoutAlignBottom /></button></Tooltip>
                  </div>
                </div>
              </div>
            </Row>
          );
        })()}
        <Row>
          <Field label="Type">
            <SelectInput prop="position" value={positionType} options={["static", "relative", "absolute", "fixed", "sticky"]} onChange={onPropertyChange} />
          </Field>
        </Row>
        {(positionType === "absolute" || positionType === "fixed") && (
          <Row>
            <ConstraintsInput
              top={s.top}
              right={s.right}
              bottom={s.bottom}
              left={s.left}
              pins={pins}
              centered={centered}
              onChange={onPropertyChange}
              onPinChange={handlePinChange}
              onCenterChange={setCentered}
            />
          </Row>
        )}
        {positionType === "relative" && (
          <RowGroup label="Offsets">
            <div className="retune-row">
              <NumberInput label="T" prop="top" value={s.top} onChange={onPropertyChange} {...changeProps("top")} />
              <NumberInput label="R" prop="right" value={s.right} onChange={onPropertyChange} {...changeProps("right")} />
            </div>
            <div className="retune-row">
              <NumberInput label="B" prop="bottom" value={s.bottom} onChange={onPropertyChange} {...changeProps("bottom")} />
              <NumberInput label="L" prop="left" value={s.left} onChange={onPropertyChange} {...changeProps("left")} />
            </div>
          </RowGroup>
        )}
        {isSticky && (
          <RowGroup label="Sticky offset">
            <div className="retune-row">
              <NumberInput label="T" prop="top" value={s.top} onChange={onPropertyChange} {...changeProps("top")} />
              <NumberInput label="B" prop="bottom" value={s.bottom} onChange={onPropertyChange} {...changeProps("bottom")} />
            </div>
          </RowGroup>
        )}
      </Section>}

      {/* Layout (hidden for SVG child shapes) */}
      {!isSvgChild && <Section label="Layout">
        <Row>
          <Field label="Display">
            <SegmentedControl
              options={DISPLAY_OPTIONS}
              value={
                displayValue.includes("flex")
                  ? (s.flexDirection || "row").startsWith("column") ? "flex-column" : "flex-row"
                  : displayValue.includes("grid") ? "grid" : "block"
              }
              onChange={(v) => {
                if (v === "flex-row") {
                  onPropertyChange("display", "flex");
                  onPropertyChange("flexDirection", "row");
                } else if (v === "flex-column") {
                  onPropertyChange("display", "flex");
                  onPropertyChange("flexDirection", "column");
                } else {
                  onPropertyChange("display", v);
                }
              }}
            />
          </Field>
        </Row>
        {isFlex && (
          <>
            <div className="retune-section-row">
              <div className="retune-row" style={{ alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <Field label="Alignment">
                    <AlignmentGrid
                      justifyContent={s.justifyContent || "flex-start"}
                      alignItems={s.alignItems || "stretch"}
                      flexDirection={s.flexDirection || "row"}
                      onChange={onPropertyChange}
                    />
                  </Field>
                </div>
                <div style={{ flex: 1 }} onPointerEnter={() => onPropertyHover?.("gap")} onPointerLeave={() => onPropertyHover?.(null)}>
                  <Field label="Gap">
                    <NumberInput
                      label={<Tooltip content={(s.flexDirection || "row").startsWith("column") ? "Vertical gap between items" : "Horizontal gap between items"} side="top" sideOffset={14}>{(s.flexDirection || "row").startsWith("column") ? <AlSpacingVertical /> : <AlSpacingHorizontal />}</Tooltip>}
                      prop="gap"
                      value={s.gap}
                      onChange={onPropertyChange}
                      min={0}
                      {...changeProps("gap")}
                    />
                  </Field>
                </div>
              </div>
            </div>
            <Row>
              <Field label="Reverse">
                <SelectInput
                  prop="flexDirection"
                  value={(s.flexDirection || "row").includes("reverse") ? "yes" : "no"}
                  options={["no", "yes"]}
                  onChange={(_, v) => {
                    const base = (s.flexDirection || "row").startsWith("column") ? "column" : "row";
                    onPropertyChange("flexDirection", v === "yes" ? `${base}-reverse` : base);
                  }}
                />
              </Field>
              <Field label="Wrap">
                <SelectInput prop="flexWrap" value={s.flexWrap} options={["nowrap", "wrap", "wrap-reverse"]} onChange={onPropertyChange} />
              </Field>
            </Row>
          </>
        )}
        {isGrid && (
          <Row>
            <div style={{ flex: 1 }}>
              <Field label="Grid">
                <GridPicker
                  columns={parseGridCount(s.gridTemplateColumns)}
                  rows={parseGridCount(s.gridTemplateRows)}
                  onChange={onPropertyChange}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }} onPointerEnter={() => onPropertyHover?.("gap")} onPointerLeave={() => onPropertyHover?.(null)}>
              <Field label="Gap">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <NumberInput label={<Tooltip content="Horizontal gap between columns" side="top" sideOffset={14}><AlSpacingHorizontal /></Tooltip>} prop="columnGap" value={s.columnGap} onChange={onPropertyChange} min={0} {...variableProps("columnGap")} {...changeProps("columnGap")} />
                  <NumberInput label={<Tooltip content="Vertical gap between rows" side="top" sideOffset={14}><AlSpacingVertical /></Tooltip>} prop="rowGap" value={s.rowGap} onChange={onPropertyChange} min={0} {...variableProps("rowGap")} {...changeProps("rowGap")} />
                </div>
              </Field>
            </div>
          </Row>
        )}
        <RowGroup label="Padding">
          {paddingExpanded ? (
            <>
              <div className="retune-row">
                <div onPointerEnter={() => onPropertyHover?.("paddingLeft")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
                  <NumberInput label={<Tooltip content="Padding left" side="top" sideOffset={14}><AlPaddingLeft /></Tooltip>} prop="paddingLeft" value={s.paddingLeft} onChange={onPropertyChange} min={0} {...variableProps("paddingLeft")} {...changeProps("paddingLeft")} />
                </div>
                <div onPointerEnter={() => onPropertyHover?.("paddingTop")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
                  <NumberInput label={<Tooltip content="Padding top" side="top" sideOffset={14}><AlPaddingTop /></Tooltip>} prop="paddingTop" value={s.paddingTop} onChange={onPropertyChange} min={0} {...variableProps("paddingTop")} {...changeProps("paddingTop")} />
                </div>
                <Tooltip content="Collapse to axes" side="top">
                  <button className="retune-split-btn active" onClick={() => setPaddingExpanded(false)}>
                    <AlPaddingSides />
                  </button>
                </Tooltip>
              </div>
              <div className="retune-row">
                <div onPointerEnter={() => onPropertyHover?.("paddingRight")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
                  <NumberInput label={<Tooltip content="Padding right" side="top" sideOffset={14}><AlPaddingRight /></Tooltip>} prop="paddingRight" value={s.paddingRight} onChange={onPropertyChange} min={0} {...variableProps("paddingRight")} {...changeProps("paddingRight")} />
                </div>
                <div onPointerEnter={() => onPropertyHover?.("paddingBottom")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
                  <NumberInput label={<Tooltip content="Padding bottom" side="top" sideOffset={14}><AlPaddingBottom /></Tooltip>} prop="paddingBottom" value={s.paddingBottom} onChange={onPropertyChange} min={0} {...variableProps("paddingBottom")} {...changeProps("paddingBottom")} />
                </div>
                <div style={{ width: 32 }} />
              </div>
            </>
          ) : (
            <div className="retune-row">
              <div style={{ flex: 1 }} onPointerEnter={() => onPropertyHover?.("paddingInline")} onPointerLeave={() => onPropertyHover?.(null)}>
                <ShorthandInput
                  label={<Tooltip content="Horizontal padding (left, right)" side="top" sideOffset={14}><AlPaddingHorizontal /></Tooltip>}
                  props={["paddingLeft", "paddingRight"]}
                  values={[s.paddingLeft, s.paddingRight]}
                  onChange={onPropertyChange}
                  min={0}
                  {...shorthandVariableProps(["paddingLeft", "paddingRight"])}
                  {...shorthandChangeProps(["paddingLeft", "paddingRight"])}
                />
              </div>
              <div style={{ flex: 1 }} onPointerEnter={() => onPropertyHover?.("paddingBlock")} onPointerLeave={() => onPropertyHover?.(null)}>
                <ShorthandInput
                  label={<Tooltip content="Vertical padding (top, bottom)" side="top" sideOffset={14}><AlPaddingVertical /></Tooltip>}
                  props={["paddingTop", "paddingBottom"]}
                  values={[s.paddingTop, s.paddingBottom]}
                  onChange={onPropertyChange}
                  min={0}
                  {...shorthandVariableProps(["paddingTop", "paddingBottom"])}
                  {...shorthandChangeProps(["paddingTop", "paddingBottom"])}
                />
              </div>
              <Tooltip content="Edit individual sides" side="top">
                <button className="retune-split-btn" onClick={() => setPaddingExpanded(true)}>
                  <AlPaddingSides />
                </button>
              </Tooltip>
            </div>
          )}
        </RowGroup>
        <RowGroup label="Margin">
          {marginExpanded ? (
            <>
              <div className="retune-row">
                <div onPointerEnter={() => onPropertyHover?.("marginLeft")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
                  <NumberInput label={<Tooltip content="Margin left" side="top" sideOffset={14}><AlPaddingLeft /></Tooltip>} prop="marginLeft" value={s.marginLeft} onChange={onPropertyChange} {...variableProps("marginLeft")} {...changeProps("marginLeft")} />
                </div>
                <div onPointerEnter={() => onPropertyHover?.("marginTop")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
                  <NumberInput label={<Tooltip content="Margin top" side="top" sideOffset={14}><AlPaddingTop /></Tooltip>} prop="marginTop" value={s.marginTop} onChange={onPropertyChange} {...variableProps("marginTop")} {...changeProps("marginTop")} />
                </div>
                <Tooltip content="Collapse to axes" side="top">
                  <button className="retune-split-btn active" onClick={() => setMarginExpanded(false)}>
                    <AlPaddingSides />
                  </button>
                </Tooltip>
              </div>
              <div className="retune-row">
                <div onPointerEnter={() => onPropertyHover?.("marginRight")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
                  <NumberInput label={<Tooltip content="Margin right" side="top" sideOffset={14}><AlPaddingRight /></Tooltip>} prop="marginRight" value={s.marginRight} onChange={onPropertyChange} {...variableProps("marginRight")} {...changeProps("marginRight")} />
                </div>
                <div onPointerEnter={() => onPropertyHover?.("marginBottom")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
                  <NumberInput label={<Tooltip content="Margin bottom" side="top" sideOffset={14}><AlPaddingBottom /></Tooltip>} prop="marginBottom" value={s.marginBottom} onChange={onPropertyChange} {...variableProps("marginBottom")} {...changeProps("marginBottom")} />
                </div>
                <div style={{ width: 32 }} />
              </div>
            </>
          ) : (
            <div className="retune-row">
              <div style={{ flex: 1 }} onPointerEnter={() => onPropertyHover?.("marginInline")} onPointerLeave={() => onPropertyHover?.(null)}>
                <ShorthandInput
                  label={<Tooltip content="Horizontal margin (left, right)" side="top" sideOffset={14}><AlPaddingHorizontal /></Tooltip>}
                  props={["marginLeft", "marginRight"]}
                  values={[s.marginLeft, s.marginRight]}
                  onChange={onPropertyChange}
                  {...shorthandVariableProps(["marginLeft", "marginRight"])}
                  {...shorthandChangeProps(["marginLeft", "marginRight"])}
                />
              </div>
              <div style={{ flex: 1 }} onPointerEnter={() => onPropertyHover?.("marginBlock")} onPointerLeave={() => onPropertyHover?.(null)}>
                <ShorthandInput
                  label={<Tooltip content="Vertical margin (top, bottom)" side="top" sideOffset={14}><AlPaddingVertical /></Tooltip>}
                  props={["marginTop", "marginBottom"]}
                  values={[s.marginTop, s.marginBottom]}
                  onChange={onPropertyChange}
                  {...shorthandVariableProps(["marginTop", "marginBottom"])}
                  {...shorthandChangeProps(["marginTop", "marginBottom"])}
                />
              </div>
              <Tooltip content="Edit individual sides" side="top">
                <button className="retune-split-btn" onClick={() => setMarginExpanded(true)}>
                  <AlPaddingSides />
                </button>
              </Tooltip>
            </div>
          )}
        </RowGroup>
      </Section>}

      {/* Size (hidden for SVG child shapes) */}
      {!isSvgChild && <Section
        label="Size"
        action={
          <>
            <Tooltip content="Add constraint" side="top">
              <button
                ref={sizeMenuBtnRef}
                className="retune-section-action"
                onClick={() => {
                  if (sizeMenuOpen) {
                    setSizeMenuOpen(false);
                    return;
                  }
                  const el = sizeMenuBtnRef.current;
                  if (!el) return;
                  const rect = el.getBoundingClientRect();
                  setSizeMenuPos({ top: rect.bottom + 4, left: rect.right });
                  setSizeMenuOpen(true);
                }}
              >
                <Plus />
              </button>
            </Tooltip>
            {sizeMenuOpen && sizeMenuPos && (
              <div
                ref={sizeMenuRef}
                style={{ position: "fixed", top: sizeMenuPos.top, left: sizeMenuPos.left, transform: "translateX(-100%)", zIndex: 2147483647 }}
              >
                <DropdownMenu
                  options={[
                    { value: "min", label: visibleSizeExtras.has("min") ? "Remove min size" : "Add min size" },
                    { value: "max", label: visibleSizeExtras.has("max") ? "Remove max size" : "Add max size" },
                  ]}
                  value={undefined}
                  showCheckmark={false}
                  onSelect={(option) => {
                    const key = option.value as SizeExtra;
                    if (visibleSizeExtras.has(key)) {
                      // Remove: reset values to defaults and hide
                      if (key === "min") {
                        onPropertyChange("minWidth", "0px");
                        onPropertyChange("minHeight", "0px");
                      } else {
                        onPropertyChange("maxWidth", "none");
                        onPropertyChange("maxHeight", "none");
                      }
                      setSizeExtras((prev) => {
                        const next = new Set(prev);
                        next.delete(key);
                        return next;
                      });
                    } else {
                      setSizeExtras((prev) => {
                        const next = new Set(prev);
                        next.add(key);
                        return next;
                      });
                    }
                    setSizeMenuOpen(false);
                  }}
                />
              </div>
            )}
          </>
        }
      >
        <Row>
          <Field label="Width">
            <ComboInput
              prop="width"
              value={widthDisplayValue}
              options={SIZE_OPTIONS}
              onChange={(prop, val) => {
                if (val === "__fill") handleSizingModeChange("width", "fill");
                else if (val === "__hug") handleSizingModeChange("width", "hug");
                else {
                  if (isFlexChild) handleSizingModeChange("width", "fixed");
                  onPropertyChange(prop, val);
                  // Aspect ratio lock: adjust height proportionally
                  if (aspectLocked) {
                    const newW = parseFloat(val);
                    if (!isNaN(newW) && aspectRatioRef.current > 0) {
                      const newH = Math.round(newW / aspectRatioRef.current);
                      requestAnimationFrame(() => onPropertyChange("height", `${newH}px`));
                    }
                  }
                }
              }}
              {...changeProps("width")}
            />
          </Field>
          <Field label="Height">
            <ComboInput
              prop="height"
              value={heightDisplayValue}
              options={heightSizeOptions}
              onChange={(prop, val) => {
                if (val === "__fill") handleSizingModeChange("height", "fill");
                else if (val === "__hug") handleSizingModeChange("height", "hug");
                else {
                  if (isFlexChild) handleSizingModeChange("height", "fixed");
                  onPropertyChange(prop, val);
                  // Aspect ratio lock: adjust width proportionally
                  if (aspectLocked) {
                    const newH = parseFloat(val);
                    if (!isNaN(newH) && aspectRatioRef.current > 0) {
                      const newW = Math.round(newH * aspectRatioRef.current);
                      requestAnimationFrame(() => onPropertyChange("width", `${newW}px`));
                    }
                  }
                }
              }}
              {...changeProps("height")}
            />
          </Field>
          <Tooltip content={aspectLocked ? "Unlock aspect ratio" : "Lock aspect ratio"} side="top">
          <button
            className={`retune-split-btn${aspectLocked ? " active" : ""}`}
            onClick={() => {
              if (!aspectLocked && element.element) {
                const rect = element.element.getBoundingClientRect();
                if (rect.height > 0) aspectRatioRef.current = rect.width / rect.height;
                element.element.setAttribute("data-retune-aspect-locked", "true");
              } else if (element.element) {
                element.element.removeAttribute("data-retune-aspect-locked");
              }
              setAspectLocked(v => !v);
            }}
          >
            {aspectLocked ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 4C14.2091 4 16 5.79086 16 8V10H16.125C17.1605 10 18 10.8395 18 11.875V17.125C18 18.1605 17.1605 19 16.125 19H7.875C6.83947 19 6 18.1605 6 17.125V11.875C6 10.8395 6.83947 10 7.875 10H8V8C8 5.79086 9.79086 4 12 4ZM7.875 11C7.39175 11 7 11.3918 7 11.875V17.125C7 17.6082 7.39175 18 7.875 18H16.125C16.6082 18 17 17.6082 17 17.125V11.875C17 11.3918 16.6082 11 16.125 11H7.875ZM15 8C15 6.34315 13.6569 5 12 5C10.3431 5 9 6.34315 9 8V10H15V8Z" fill="currentColor" fillOpacity="0.9" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M16.125 10C17.1605 10 18 10.8395 18 11.875V17.125C18 18.1605 17.1605 19 16.125 19H7.875C6.83947 19 6 18.1605 6 17.125V11.875C6 10.8395 6.83947 10 7.875 10H8V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V7.5C16 7.77614 15.7761 8 15.5 8C15.2239 8 15 7.77614 15 7.5V7C15 5.34315 13.6569 4 12 4C10.3431 4 9 5.34315 9 7V10H16.125ZM7.875 11C7.39175 11 7 11.3918 7 11.875V17.125C7 17.6082 7.39175 18 7.875 18H16.125C16.6082 18 17 17.6082 17 17.125V11.875C17 11.3918 16.6082 11 16.125 11H7.875Z" fill="currentColor" fillOpacity="0.9" />
              </svg>
            )}
          </button>
          </Tooltip>
        </Row>
        {visibleSizeExtras.has("min") && (
          <div className="retune-section-row">
            <div className="retune-row">
              <Field label="Min W">
                <NumberInput prop="minWidth" value={s.minWidth === "0px" || s.minWidth === "auto" ? "" : s.minWidth} placeholder="–" onChange={(p, v) => {
                  if (!v) onPropertyChange(p, "0px");
                  else onPropertyChange(p, v);
                }} {...changeProps("minWidth")} />
              </Field>
              <Field label="Min H">
                <NumberInput prop="minHeight" value={s.minHeight === "0px" || s.minHeight === "auto" ? "" : s.minHeight} placeholder="–" onChange={(p, v) => {
                  if (!v) onPropertyChange(p, "0px");
                  else onPropertyChange(p, v);
                }} {...changeProps("minHeight")} />
              </Field>
              <Tooltip content="Remove min size" side="top">
                <button className="retune-split-btn" onClick={() => {
                  onPropertyChange("minWidth", "0px");
                  onPropertyChange("minHeight", "0px");
                  setSizeExtras((prev) => { const next = new Set(prev); next.delete("min"); return next; });
                }}>
                  <Minus />
                </button>
              </Tooltip>
            </div>
          </div>
        )}
        {visibleSizeExtras.has("max") && (
          <div className="retune-section-row">
            <div className="retune-row">
              <Field label="Max W">
                <NumberInput prop="maxWidth" value={s.maxWidth === "none" ? "" : s.maxWidth} placeholder="–" onChange={(p, v) => {
                  if (!v) onPropertyChange(p, "none");
                  else onPropertyChange(p, v);
                }} {...changeProps("maxWidth")} />
              </Field>
              <Field label="Max H">
                <NumberInput prop="maxHeight" value={s.maxHeight === "none" ? "" : s.maxHeight} placeholder="–" onChange={(p, v) => {
                  if (!v) onPropertyChange(p, "none");
                  else onPropertyChange(p, v);
                }} {...changeProps("maxHeight")} />
              </Field>
              <Tooltip content="Remove max size" side="top">
                <button className="retune-split-btn" onClick={() => {
                  onPropertyChange("maxWidth", "none");
                  onPropertyChange("maxHeight", "none");
                  setSizeExtras((prev) => { const next = new Set(prev); next.delete("max"); return next; });
                }}>
                  <Minus />
                </button>
              </Tooltip>
            </div>
          </div>
        )}
      </Section>}

      {/* Typography (hidden for SVG child shapes) */}
      {isText && !isSvgChild && (
        <Section label="Typography">
          <Row>
            <Field label="Font">
              <FontInput prop="fontFamily" value={s.fontFamily} onChange={onPropertyChange} {...changeProps("fontFamily")} />
            </Field>
          </Row>
          <Row>
            <Field label="Size">
              <NumberInput prop="fontSize" value={s.fontSize} onChange={onPropertyChange} min={1} {...variableProps("fontSize")} {...changeProps("fontSize")} />
            </Field>
            <Field label="Weight">
              <ComboInput prop="fontWeight" value={s.fontWeight} options={FONT_WEIGHT_OPTIONS} onChange={onPropertyChange} {...variableProps("fontWeight")} {...changeProps("fontWeight")} />
            </Field>
          </Row>
          <Row>
            <Field label="Line height">
              <ComboInput prop="lineHeight" value={s.lineHeight} options={LINE_HEIGHT_OPTIONS} onChange={onPropertyChange} {...variableProps("lineHeight")} {...changeProps("lineHeight")} />
            </Field>
            <Field label="Letter spacing">
              <ComboInput prop="letterSpacing" value={s.letterSpacing} options={LETTER_SPACING_OPTIONS} onChange={onPropertyChange} {...variableProps("letterSpacing")} {...changeProps("letterSpacing")} />
            </Field>
          </Row>
          <Row>
            <Field label="Color">
              <ColorInput prop="color" value={s.color} onChange={onPropertyChange} {...variableProps("color")} {...changeProps("color")} />
            </Field>
          </Row>
          <Row>
            <Field label="Align">
              <SegmentedControl
                options={TEXT_ALIGN_OPTIONS}
                value={mapTextAlign(s.textAlign)}
                onChange={(v) => onPropertyChange("textAlign", v)}
              />
            </Field>
            <Field label="Vertical">
              <SegmentedControl
                options={VERTICAL_ALIGN_OPTIONS}
                value={mapVerticalAlign(s.verticalAlign)}
                onChange={(v) => onPropertyChange("verticalAlign", v)}
                disabled={!hasVerticalAlign}
              />
            </Field>
            <div style={{ alignSelf: "flex-end" }}>
              <Tooltip content={typoExpanded ? "Show less" : "More options"} side="top">
                <button className={`retune-split-btn${typoExpanded ? " active" : ""}`} onClick={() => setTypoExpanded((v) => !v)}>
                  <AdjustSmall />
                </button>
              </Tooltip>
            </div>
          </Row>
          {typoExpanded && (
            <>
              <Row>
                <Field label="Style">
                  <SelectInput prop="fontStyle" value={s.fontStyle} options={["normal", "italic", "oblique"]} onChange={onPropertyChange} />
                </Field>
                <Field label="Decoration">
                  <SelectInput prop="textDecoration" value={s.textDecoration} options={["none", "underline", "line-through", "overline"]} onChange={onPropertyChange} />
                </Field>
              </Row>
              <Row>
                <Field label="Transform">
                  <SelectInput prop="textTransform" value={s.textTransform} options={["none", "uppercase", "lowercase", "capitalize"]} onChange={onPropertyChange} />
                </Field>
                <Field label="White space">
                  <SelectInput prop="whiteSpace" value={s.whiteSpace} options={["normal", "nowrap", "pre", "pre-wrap", "pre-line", "break-spaces"]} onChange={onPropertyChange} />
                </Field>
              </Row>
              {(() => {
                const truncation = detectTruncation(s);
                const ctx = { currentDisplay: s.display };

                const applyChanges = (changes: Record<string, string>) => {
                  for (const [prop, value] of Object.entries(changes)) {
                    onPropertyChange(prop, value);
                  }
                };

                const fixAncestorMinWidth = (enabled: boolean) => {
                  if (!onApplyToElement) return;
                  let el = element.element?.parentElement;
                  while (el && el !== document.body) {
                    const parentDisplay = getComputedStyle(el.parentElement || el).display;
                    const isGridOrFlexChild = parentDisplay.includes("grid") || parentDisplay.includes("flex");
                    if (isGridOrFlexChild) {
                      onApplyToElement(el, "minWidth", enabled ? "0px" : "");
                    }
                    el = el.parentElement;
                  }
                };

                return (
                  <>
                    <Row>
                      <Field label="Truncate">
                        <SelectInput
                          prop="truncate"
                          value={truncation.enabled ? "ellipsis" : "none"}
                          options={["none", "ellipsis"]}
                          onChange={(_p, val) => {
                            const enabled = val === "ellipsis";
                            const changes = computeTruncationChanges(
                              { enabled, lines: 1 },
                              ctx,
                            );
                            applyChanges(changes);
                            fixAncestorMinWidth(enabled);
                          }}
                        />
                      </Field>
                      {truncation.enabled && (
                        <Field label="Max lines">
                          <NumberInput
                            prop="lineClamp"
                            value={String(truncation.lines)}
                            onChange={(_p, val) => {
                              const n = parseInt(val) || 1;
                              const changes = computeTruncationChanges(
                                { enabled: true, lines: n },
                                ctx,
                              );
                              applyChanges(changes);
                            }}
                            {...changeProps("lineClamp")}
                          />
                        </Field>
                      )}
                    </Row>
                    <Row>
                      <Field label="Word break">
                        <SelectInput prop="overflowWrap" value={s.overflowWrap} options={["normal", "break-word", "anywhere"]} onChange={onPropertyChange} />
                      </Field>
                      {["UL", "OL", "LI"].includes(element.tagName) && (
                        <Field label="List style">
                          <SegmentedControl
                            options={LIST_STYLE_OPTIONS}
                            value={s.listStyleType || "none"}
                            onChange={(val) => onPropertyChange("listStyleType", val)}
                          />
                        </Field>
                      )}
                    </Row>
                  </>
                );
              })()}
            </>
          )}
        </Section>
      )}

      {/* Appearance (hidden for SVG child shapes) */}
      {!isSvgChild && <Section label="Appearance">
        <Row>
          <Field label="Opacity">
            <NumberInput prop="opacity" value={s.opacity} onChange={onPropertyChange} min={0} max={1} step={0.01} {...variableProps("opacity")} {...changeProps("opacity")} />
          </Field>
          <Field label="Z index">
            <NumberInput prop="zIndex" value={s.zIndex} onChange={onPropertyChange} {...changeProps("zIndex")} />
          </Field>
        </Row>
        <RowGroup label="Corner radius">
          {radiusExpanded ? (
            <>
              <div className="retune-row">
                <NumberInput label={<Tooltip content="Top left corner radius" side="top" sideOffset={14}><RadiusTopLeft /></Tooltip>} prop="borderTopLeftRadius" value={s.borderTopLeftRadius} onChange={onPropertyChange} min={0} {...variableProps("borderTopLeftRadius")} {...changeProps("borderTopLeftRadius")} />
                <NumberInput label={<Tooltip content="Top right corner radius" side="top" sideOffset={14}><RadiusTopRight /></Tooltip>} prop="borderTopRightRadius" value={s.borderTopRightRadius} onChange={onPropertyChange} min={0} {...variableProps("borderTopRightRadius")} {...changeProps("borderTopRightRadius")} />
                <Tooltip content="Collapse to single" side="top">
                  <button className="retune-split-btn active" onClick={() => setRadiusExpanded(false)}>
                    <AlPaddingSides />
                  </button>
                </Tooltip>
              </div>
              <div className="retune-row">
                <NumberInput label={<Tooltip content="Bottom left corner radius" side="top" sideOffset={14}><RadiusBottomLeft /></Tooltip>} prop="borderBottomLeftRadius" value={s.borderBottomLeftRadius} onChange={onPropertyChange} min={0} {...variableProps("borderBottomLeftRadius")} {...changeProps("borderBottomLeftRadius")} />
                <NumberInput label={<Tooltip content="Bottom right corner radius" side="top" sideOffset={14}><RadiusBottomRight /></Tooltip>} prop="borderBottomRightRadius" value={s.borderBottomRightRadius} onChange={onPropertyChange} min={0} {...variableProps("borderBottomRightRadius")} {...changeProps("borderBottomRightRadius")} />
                <div style={{ width: 32 }} />
              </div>
            </>
          ) : (
            <div className="retune-row">
              <ShorthandInput
                label={<Tooltip content="Corner radius (TL, TR, BR, BL)" side="top" sideOffset={14}><RadiusTopLeft /></Tooltip>}
                props={["borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"]}
                values={[s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius]}
                onChange={onPropertyChange}
                min={0}
                {...shorthandVariableProps(["borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"])}
                {...shorthandChangeProps(["borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"])}
              />
              <Tooltip content="Edit individual corners" side="top">
                <button className="retune-split-btn" onClick={() => setRadiusExpanded(true)}>
                  <AlPaddingSides />
                </button>
              </Tooltip>
            </div>
          )}
        </RowGroup>
        <Row>
          <Field label="Overflow">
            <SelectInput prop="overflow" value={s.overflow} options={["visible", "hidden", "auto", "scroll"]} onChange={onPropertyChange} />
          </Field>
        </Row>
      </Section>}

      {/* SVG Fill — always visible for SVG child shapes */}
      {isSvgChild && (() => {
        const hasFill = s.fill && s.fill !== "none" && s.fill !== "transparent";
        return (
          <Section label="Fill" action={
            hasFill ? (
              <Tooltip content="Remove fill" side="top"><button className="retune-section-action" onClick={() => onPropertyChange("fill", "none")}><Minus /></button></Tooltip>
            ) : (
              <Tooltip content="Add fill" side="top"><button className="retune-section-action" onClick={() => onPropertyChange("fill", "#000000")}><Plus /></button></Tooltip>
            )
          }>
            {hasFill && (
              <RowGroup label="Color">
                <div className="retune-row">
                  <ColorInput prop="fill" value={s.fill} onChange={onPropertyChange} {...variableProps("fill")} {...changeProps("fill")} />
                </div>
              </RowGroup>
            )}
          </Section>
        );
      })()}

      {/* SVG Stroke — always visible for SVG child shapes */}
      {isSvgChild && (() => {
        const hasStroke = s.stroke && s.stroke !== "none" && s.stroke !== "transparent";
        return (
          <Section label="Stroke" action={
            hasStroke ? (
              <Tooltip content="Remove stroke" side="top"><button className="retune-section-action" onClick={() => { onPropertyChange("stroke", "none"); onPropertyChange("strokeWidth", "0"); }}><Minus /></button></Tooltip>
            ) : (
              <Tooltip content="Add stroke" side="top"><button className="retune-section-action" onClick={() => { onPropertyChange("stroke", "#000000"); onPropertyChange("strokeWidth", "1"); }}><Plus /></button></Tooltip>
            )
          }>
            {hasStroke && (
              <>
                <RowGroup label="Color">
                  <div className="retune-row">
                    <ColorInput prop="stroke" value={s.stroke} onChange={onPropertyChange} {...variableProps("stroke")} {...changeProps("stroke")} />
                  </div>
                </RowGroup>
                <RowGroup label="Width">
                  <div className="retune-row">
                    <NumberInput label="" prop="strokeWidth" value={s.strokeWidth || "1"} onChange={onPropertyChange} min={0} step={0.5} {...variableProps("strokeWidth")} {...changeProps("strokeWidth")} />
                  </div>
                </RowGroup>
              </>
            )}
          </Section>
        );
      })()}

      {/* Fill (hidden for images/videos and SVG child shapes) */}
      {!isMedia && !isSvgChild && (() => {
        const fillVarMatch = getVariableMatch("backgroundColor");
        const fillHasVariable = !!fillVarMatch;

        return (
          <Section
            label="Fill"
            gap={8}
            action={
              <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                {!fillHasVariable && (
                  <VariableAction
                    property="backgroundColor"
                    onVariableSelect={handleVariableSelect}
                    onVariableApply={(v, props) => {
                      const val = Object.values(v.values)[0];
                      if (val) onPropertyChange("backgroundColor", val);
                      onVariableAssociate?.(props, { className: v.className, values: v.values });
                    }}
                  />
                )}
                {hasFill || fillHasVariable ? (
                  <Tooltip content="Remove fill" side="top"><button className="retune-section-action" onClick={handleRemoveFill}><Minus /></button></Tooltip>
                ) : (
                  <Tooltip content="Add fill" side="top"><button className="retune-section-action" onClick={handleAddFill}><Plus /></button></Tooltip>
                )}
              </div>
            }
          >
            {(hasFill || fillHasVariable) ? (
              <>
                <Row>
                  <SelectInput
                    prop="fillMode"
                    value={fillMode === "solid" ? "solid" : gradient.type}
                    options={["solid", "linear", "radial", "conic"]}
                    onChange={handleFillModeChange}
                    isChanged={changeProps("backgroundImage").isChanged}
                    onReset={() => { onPropertyReset?.("backgroundImage"); onPropertyReset?.("backgroundColor"); }}
                  />
                </Row>
                {fillMode === "solid" ? (
                  <Row>
                    <ColorInput prop="backgroundColor" value={s.backgroundColor} onChange={onPropertyChange} {...variableProps("backgroundColor")} {...changeProps("backgroundColor")} />
                  </Row>
                ) : (
                  <GradientEditor
                    gradient={gradient}
                    onChange={handleGradientChange}
                    originalGradient={initialGradient ?? undefined}
                    isNewGradient={initialFillMode === "solid"}
                  />
                )}
              </>
            ) : null}
          </Section>
        );
      })()}


      {/* Image / Media */}
      {isMedia && (
        <Section label="Image">
          <Row>
            <Field label="Fit">
              <SelectInput
                prop="objectFit"
                value={s.objectFit || "fill"}
                options={["fill", "contain", "cover", "none", "scale-down"]}
                onChange={onPropertyChange}
                {...variableProps("objectFit")}
                {...changeProps("objectFit")}
              />
            </Field>
            <Field label="Position">
              <ComboInput
                prop="objectPosition"
                value={s.objectPosition || "50% 50%"}
                options={[
                  { value: "center", label: "Center" },
                  { value: "top", label: "Top" },
                  { value: "bottom", label: "Bottom" },
                  { value: "left", label: "Left" },
                  { value: "right", label: "Right" },
                  { value: "top left", label: "Top Left" },
                  { value: "top right", label: "Top Right" },
                  { value: "bottom left", label: "Bottom Left" },
                  { value: "bottom right", label: "Bottom Right" },
                ]}
                onChange={onPropertyChange}
                {...variableProps("objectPosition")}
                {...changeProps("objectPosition")}
              />
            </Field>
          </Row>
          {isImage && element.element && (
            <Row>
              <Field label="Loading">
                <SegmentedControl
                  options={[{ value: "lazy", label: "Lazy" }, { value: "eager", label: "Eager" }]}
                  value={((element.element as HTMLImageElement).loading === "lazy") ? "lazy" : "eager"}
                  onChange={(v) => {
                    (element.element as HTMLImageElement).loading = v as "lazy" | "eager";
                    onPropertyChange("loading", v);
                  }}
                />
              </Field>
            </Row>
          )}
          {isImage && element.element && (
            <RowGroup label="Alt">
              <div className="retune-row">
                <TextInput
                  label=""
                  prop="alt"
                  value={(element.element as HTMLImageElement).alt || ""}
                  onChange={(prop, value) => {
                    if (element.element) {
                      (element.element as HTMLImageElement).alt = value;
                      onPropertyChange(prop, value);
                    }
                  }}
                />
              </div>
            </RowGroup>
          )}
        </Section>
      )}

      {/* Video */}
      {isVideo && element.element && (
        <Section label="Video">
          <RowGroup label="Autoplay">
            <div className="retune-row">
              <SegmentedControl
                options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]}
                value={(element.element as HTMLVideoElement).autoplay ? "true" : "false"}
                onChange={(v) => {
                  (element.element as HTMLVideoElement).autoplay = v === "true";
                  onPropertyChange("autoplay", v === "true" ? "true" : "false");
                }}
              />
            </div>
          </RowGroup>
          <RowGroup label="Loop">
            <div className="retune-row">
              <SegmentedControl
                options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]}
                value={(element.element as HTMLVideoElement).loop ? "true" : "false"}
                onChange={(v) => {
                  (element.element as HTMLVideoElement).loop = v === "true";
                  onPropertyChange("loop", v === "true" ? "true" : "false");
                }}
              />
            </div>
          </RowGroup>
          <RowGroup label="Muted">
            <div className="retune-row">
              <SegmentedControl
                options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]}
                value={(element.element as HTMLVideoElement).muted ? "true" : "false"}
                onChange={(v) => {
                  (element.element as HTMLVideoElement).muted = v === "true";
                  onPropertyChange("muted", v === "true" ? "true" : "false");
                }}
              />
            </div>
          </RowGroup>
          <RowGroup label="Controls">
            <div className="retune-row">
              <SegmentedControl
                options={[{ value: "true", label: "Show" }, { value: "false", label: "Hide" }]}
                value={(element.element as HTMLVideoElement).controls ? "true" : "false"}
                onChange={(v) => {
                  (element.element as HTMLVideoElement).controls = v === "true";
                  onPropertyChange("controls", v === "true" ? "true" : "false");
                }}
              />
            </div>
          </RowGroup>
        </Section>
      )}

      {/* Background Image */}
      {hasBackgroundImage && (
        <Section label="Background Image">
          <RowGroup label="Size">
            <div className="retune-row">
              <ComboInput
                label=""
                prop="backgroundSize"
                value={s.backgroundSize || "auto"}
                options={[
                  { value: "cover", label: "Cover" },
                  { value: "contain", label: "Contain" },
                  { value: "auto", label: "Auto" },
                  { value: "100% 100%", label: "Stretch" },
                ]}
                onChange={onPropertyChange}
                {...variableProps("backgroundSize")}
                {...changeProps("backgroundSize")}
              />
            </div>
          </RowGroup>
          <RowGroup label="Position">
            <div className="retune-row">
              <SelectInput
                prop="backgroundPosition"
                value={s.backgroundPosition || "center center"}
                options={["center", "top", "bottom", "left", "right", "top left", "top right", "bottom left", "bottom right"]}
                onChange={onPropertyChange}
                {...variableProps("backgroundPosition")}
                {...changeProps("backgroundPosition")}
              />
            </div>
          </RowGroup>
          <RowGroup label="Repeat">
            <div className="retune-row">
              <SelectInput
                prop="backgroundRepeat"
                value={s.backgroundRepeat || "repeat"}
                options={["no-repeat", "repeat", "repeat-x", "repeat-y", "space", "round"]}
                onChange={onPropertyChange}
                {...variableProps("backgroundRepeat")}
                {...changeProps("backgroundRepeat")}
              />
            </div>
          </RowGroup>
        </Section>
      )}

      {/* Border (hidden for SVG child shapes — they use Stroke) */}
      {!isSvgChild && (<Section
        label="Border"
        action={
          hasBorder ? (
            <Tooltip content="Remove border" side="top"><button className="retune-section-action" onClick={handleRemoveBorder}><Minus /></button></Tooltip>
          ) : (
            <Tooltip content="Add border" side="top"><button className="retune-section-action" onClick={handleAddBorder}><Plus /></button></Tooltip>
          )
        }
      >
        {hasBorder && (
          <>
            <Row>
              <Field label="Color">
                <ColorInput prop="borderColor" value={activeBorderColor} onChange={onPropertyChange} {...variableProps("borderColor")} {...changeProps("borderColor")} />
              </Field>
            </Row>
            <RowGroup label={borderExpanded ? undefined : "Width"}>
              {borderExpanded ? (
                <>
                  <div className="retune-row">
                    <Field label="Top">
                      <NumberInput prop="borderTopWidth" value={s.borderTopWidth} onChange={(p, v) => {
                        onPropertyChange(p, v);
                        if (parseFloat(v) > 0 && s.borderTopStyle === "none") onPropertyChange("borderTopStyle", "solid");
                      }} min={0} {...changeProps("borderTopWidth")} />
                    </Field>
                    <Field label="Right">
                      <NumberInput prop="borderRightWidth" value={s.borderRightWidth} onChange={(p, v) => {
                        onPropertyChange(p, v);
                        if (parseFloat(v) > 0 && s.borderRightStyle === "none") onPropertyChange("borderRightStyle", "solid");
                      }} min={0} {...changeProps("borderRightWidth")} />
                    </Field>
                    <Tooltip content="Collapse to shorthand" side="top">
                      <button className="retune-split-btn active" onClick={() => setBorderExpanded(false)}>
                        <AlPaddingSides />
                      </button>
                    </Tooltip>
                  </div>
                  <div className="retune-row">
                    <Field label="Bottom">
                      <NumberInput prop="borderBottomWidth" value={s.borderBottomWidth} onChange={(p, v) => {
                        onPropertyChange(p, v);
                        if (parseFloat(v) > 0 && s.borderBottomStyle === "none") onPropertyChange("borderBottomStyle", "solid");
                      }} min={0} {...changeProps("borderBottomWidth")} />
                    </Field>
                    <Field label="Left">
                      <NumberInput prop="borderLeftWidth" value={s.borderLeftWidth} onChange={(p, v) => {
                        onPropertyChange(p, v);
                        if (parseFloat(v) > 0 && s.borderLeftStyle === "none") onPropertyChange("borderLeftStyle", "solid");
                      }} min={0} {...changeProps("borderLeftWidth")} />
                    </Field>
                    <div style={{ width: 32 }} />
                  </div>
                </>
              ) : (
                <div className="retune-row">
                  <ShorthandInput
                    props={["borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"]}
                    values={[s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth]}
                    onChange={onPropertyChange}
                    min={0}
                    {...shorthandVariableProps(["borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"])}
                    {...shorthandChangeProps(["borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"])}
                  />
                  <Tooltip content="Edit individual sides" side="top">
                    <button className="retune-split-btn" onClick={() => setBorderExpanded(true)}>
                      <AlPaddingSides />
                    </button>
                  </Tooltip>
                </div>
              )}
            </RowGroup>
            <Row>
              <Field label="Style">
                <SelectInput prop="borderStyle" value={s.borderTopStyle !== "none" ? s.borderTopStyle : s.borderRightStyle !== "none" ? s.borderRightStyle : s.borderBottomStyle !== "none" ? s.borderBottomStyle : s.borderLeftStyle} options={["solid", "dashed", "dotted", "double", "groove", "ridge"]} onChange={onPropertyChange} />
              </Field>
            </Row>
          </>
        )}
      </Section>)}

      {/* Shadow */}
      {(() => {
        const shadowVarMatch = getVariableMatch("boxShadow");
        const shadowHasVariable = !!shadowVarMatch;

        return (
          <Section
            label="Shadow"
            action={
              <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                {!shadowHasVariable && (
                  <VariableAction
                    property="boxShadow"
                    onVariableSelect={handleVariableSelect}
                    onVariableApply={(v, props) => {
                      const val = Object.values(v.values)[0];
                      if (val) onPropertyChange("boxShadow", val);
                      onVariableAssociate?.(props, { className: v.className, values: v.values });
                    }}
                  />
                )}
                {hasShadow || shadowHasVariable ? (
                  <Tooltip content="Remove shadow" side="top"><button className="retune-section-action" onClick={handleRemoveShadow}><Minus /></button></Tooltip>
                ) : (
                  <Tooltip content="Add shadow" side="top"><button className="retune-section-action" onClick={handleAddShadow}><Plus /></button></Tooltip>
                )}
              </div>
            }
          >
            {shadowHasVariable ? (() => {
              const shadowPickerRef = { current: null as (() => void) | null };
              return (
                <Row>
                  <div className="retune-prop retune-prop-variable-applied" style={{ flex: 1, cursor: "pointer" }} onClick={() => shadowPickerRef.current?.()}>
                    <ChangeIndicator isChanged={changeProps("boxShadow").isChanged} onReset={changeProps("boxShadow").onReset} />
                    <span className="retune-prop-input" style={{ display: "flex", alignItems: "center", paddingLeft: 12, color: "var(--retune-text)" }}>
                      {shadowVarMatch.variable.className.startsWith("var(--")
                        ? shadowVarMatch.variable.className.slice(6, -1)
                        : shadowVarMatch.variable.className}
                    </span>
                    <VariableAction
                      match={shadowVarMatch}
                      property="boxShadow"
                      onVariableSelect={handleVariableSelect}
                      onVariableApply={handleVariableApply}
                      onVariableUnlink={() => onVariableUnlink?.(["boxShadow"])}
                      openPickerRef={shadowPickerRef}
                    />
                  </div>
                </Row>
              );
            })() : hasShadow ? (() => {
              const shadow = parseBoxShadow(s.boxShadow);
              if (!shadow) return null;
              return (
                <>
                  <Row>
                    <Field label="Color">
                      <ColorInput
                        prop="shadowColor"
                        value={shadow.color}
                        onChange={(_p, val) => handleShadowFieldChange("color", val)}
                        {...changeProps("shadowColor")}
                      />
                    </Field>
                  </Row>
                  <Row>
                    <Field label="X offset">
                      <NumberInput
                        prop="shadowOffsetX"
                        value={`${shadow.offsetX}px`}
                        onChange={(_p, val) => handleShadowFieldChange("offsetX", parseFloat(val) || 0)}
                        {...changeProps("shadowOffsetX")}
                      />
                    </Field>
                    <Field label="Y offset">
                      <NumberInput
                        prop="shadowOffsetY"
                        value={`${shadow.offsetY}px`}
                        onChange={(_p, val) => handleShadowFieldChange("offsetY", parseFloat(val) || 0)}
                        {...changeProps("shadowOffsetY")}
                      />
                    </Field>
                  </Row>
                  <Row>
                    <Field label="Blur">
                      <NumberInput
                        prop="shadowBlur"
                        value={`${shadow.blur}px`}
                        onChange={(_p, val) => handleShadowFieldChange("blur", Math.max(0, parseFloat(val) || 0))}
                        min={0}
                        {...changeProps("shadowBlur")}
                      />
                    </Field>
                    <Field label="Spread">
                      <NumberInput
                        prop="shadowSpread"
                        value={`${shadow.spread}px`}
                        onChange={(_p, val) => handleShadowFieldChange("spread", parseFloat(val) || 0)}
                        {...changeProps("shadowSpread")}
                      />
                    </Field>
                  </Row>
                  <Row>
                    <Field label="Type">
                      <SelectInput
                        prop="shadowInset"
                        value={shadow.inset ? "inside" : "outside"}
                        options={["outside", "inside"]}
                        onChange={(_p, val) => handleShadowFieldChange("inset", val === "inside")}
                      />
                    </Field>
                  </Row>
                </>
              );
            })() : null}
          </Section>
        );
      })()}

      {/* Filters (hidden for SVG child shapes) */}
      {!isSvgChild && <Section
        label="Filters"
        action={
          <div style={{ position: "relative" }}>
            <Tooltip content="Add filter" side="top">
              <button
                ref={filterMenuBtnRef}
                className="retune-section-action"
                onClick={() => {
                  if (filterMenuOpen) {
                    setFilterMenuOpen(false);
                    return;
                  }
                  const btn = filterMenuBtnRef.current;
                  if (!btn) return;
                  const rect = btn.getBoundingClientRect();
                  const spaceBelow = window.innerHeight - rect.bottom - 8;
                  const spaceAbove = rect.top - 8;
                  if (spaceBelow >= spaceAbove) {
                    setFilterMenuPos({ top: rect.bottom + 4, left: rect.right });
                  } else {
                    setFilterMenuPos({ bottom: window.innerHeight - rect.top + 4, left: rect.right });
                  }
                  setFilterMenuOpen(true);
                }}
              >
                <Plus />
              </button>
            </Tooltip>
            {filterMenuOpen && filterMenuPos && (
              <div
                ref={filterMenuRef}
                style={{
                  position: "fixed",
                  ...(filterMenuPos.top != null ? { top: filterMenuPos.top } : { bottom: filterMenuPos.bottom }),
                  left: filterMenuPos.left,
                  transform: "translateX(-100%)",
                  zIndex: 2147483647,
                }}
              >
                <DropdownMenu
                  options={(() => {
                    const usedLayer = new Set(filters.filter((f) => f.target === "layer").map((f) => f.type));
                    const usedBackdrop = new Set(filters.filter((f) => f.target === "backdrop").map((f) => f.type));
                    const availLayer = FILTER_TYPES.filter((t) => !usedLayer.has(t));
                    const availBackdrop = FILTER_TYPES.filter((t) => !usedBackdrop.has(t));
                    const opts: DropdownMenuOption[] = [];
                    availLayer.forEach((t, i) => {
                      opts.push({
                        value: `layer:${t}`,
                        label: FILTER_CONFIG[t].label,
                        ...(i === 0 ? { headingBefore: "Layer" } : {}),
                      });
                    });
                    availBackdrop.forEach((t, i) => {
                      opts.push({
                        value: `backdrop:${t}`,
                        label: FILTER_CONFIG[t].label,
                        ...(i === 0 ? { headingBefore: "Backdrop", ...(availLayer.length > 0 ? { separatorBefore: true } : {}) } : {}),
                      });
                    });
                    return opts;
                  })()}
                  showCheckmark={false}
                  onSelect={(option) => {
                    const [target, type] = option.value.split(":") as [FilterTarget, FilterType];
                    handleAddFilter(type, target);
                  }}
                />
              </div>
            )}
          </div>
        }
      >
        {filters.length > 0 && (() => {
          const layerFilters = filters.filter((f) => f.target === "layer");
          const backdropFilters = filters.filter((f) => f.target === "backdrop");
          const renderFilterRow = (f: FilterItem) => {
            const config = FILTER_CONFIG[f.type];
            return (
              <div className="retune-row" key={f.id}>
                <SliderInput
                  label={config.label}
                  prop={f.id}
                  value={String(f.value)}
                  min={config.min}
                  max={config.max}
                  step={config.step}
                  onChange={(_p, val) => handleFilterValueChange(f.id, parseFloat(val) || 0)}
                />
                <div style={{ alignSelf: "center" }}>
                  <Tooltip content="Remove" side="top">
                    <button className="retune-split-btn" onClick={() => handleRemoveFilter(f.id)}>
                      <Minus />
                    </button>
                  </Tooltip>
                </div>
              </div>
            );
          };

          return (
            <>
              {layerFilters.length > 0 && (
                <RowGroup label={backdropFilters.length > 0 ? "Layer" : undefined}>
                  {layerFilters.map(renderFilterRow)}
                </RowGroup>
              )}
              {backdropFilters.length > 0 && (
                <RowGroup label={layerFilters.length > 0 ? "Backdrop" : undefined}>
                  {backdropFilters.map(renderFilterRow)}
                </RowGroup>
              )}
            </>
          );
        })()}
      </Section>}
      <div ref={filterSectionRef} />
    </>
  );
}

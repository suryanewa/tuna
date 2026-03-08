/**
 * PropertyPanel — the right-side inspector panel showing
 * editable properties for the selected element.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { InspectedElement } from "../types";
import type { BoxModelProperty } from "../ui/box-model-overlay";
import { Section, Row, RowGroup, Field } from "../ui/section";
import { NumberInput } from "../ui/number-input";
import { ComboInput, type ComboOption } from "../ui/combo-input";
import { ColorInput } from "../ui/color-input";
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
import { computeSizingChanges, type SizingMode } from "../ui/sizing-utils";
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
  Plus, Minus, ChevronDown, AdjustSmall, ListView, NumberList, EyeSmall, HiddenSmall,
} from "../ui/icons";
import { Tooltip } from "../ui/tooltip";
import { ShorthandInput } from "../ui/shorthand-input";
import { parseBoxShadow, shadowToCss, defaultShadow, type ShadowValue } from "../ui/shadow-utils";
import {
  parseFilters, filtersToCss, defaultFilter,
  FILTER_TYPES, FILTER_CONFIG,
  type FilterItem, type FilterType, type FilterTarget,
} from "../ui/filter-utils";

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

type ChangeScope = "element" | "class";

export function PropertyPanel({
  element,
  position,
  onPropertyChange,
  onPropertyHover,
  onApplyToElement,
  scope = "element",
  onScopeChange,
  sharedSelector,
}: {
  element: InspectedElement;
  position: "left" | "right";
  onPropertyChange: (property: string, value: string) => void;
  onPropertyHover?: (property: BoxModelProperty) => void;
  onApplyToElement?: (element: Element, property: string, value: string) => void;
  scope?: ChangeScope;
  onScopeChange?: (scope: ChangeScope) => void;
  sharedSelector?: { selector: string; count: number } | null;
}) {
  const s = element.computedStyles;
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

  // Auto-show size extras that have non-default values
  const visibleSizeExtras = new Set(sizeExtras);
  if ((s.minWidth && s.minWidth !== "0px" && s.minWidth !== "auto") ||
      (s.minHeight && s.minHeight !== "0px" && s.minHeight !== "auto")) visibleSizeExtras.add("min");
  if ((s.maxWidth && s.maxWidth !== "none") ||
      (s.maxHeight && s.maxHeight !== "none")) visibleSizeExtras.add("max");

  const [pins, setPins] = useState<PinState>({ top: true, right: false, bottom: false, left: true });
  const [centered, setCentered] = useState(false);
  const centeredAxes = useRef({ h: false, v: false });

  // ── Fill mode (solid vs gradient) ──
  const detectedFillMode = detectFillMode(s.backgroundColor, s.backgroundImage);
  const [fillMode, setFillMode] = useState<FillMode>(detectedFillMode);
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
      if (newMode !== "solid") {
        setFillMode(newMode);
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
    setPins((prev) => ({ ...prev, [side]: pinned }));
  }, []);

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
      {/* Header */}
      <div className="retune-panel-header">
        <div className="retune-el-tag">{element.tagName.toLowerCase()}</div>
        {element.reactComponents.length > 0 && (
          <div className="retune-el-component">{element.reactComponents.join(" \u203A ")}</div>
        )}
        {sharedSelector && sharedSelector.count > 1 && onScopeChange && (
          <div className="retune-scope-row">
            <label className="retune-scope-switch" onClick={() => onScopeChange(scope === "element" ? "class" : "element")}>
              <span className="retune-scope-label">Apply to all instances</span>
              <div className={`retune-switch-track${scope === "class" ? " on" : ""}`}>
                <div className="retune-switch-thumb" />
              </div>
            </label>
          </div>
        )}
      </div>

      {/* Position */}
      <Section label="Position">
        {/* Unified alignment row — always visible, disabled when not applicable */}
        {(() => {
          const isAbsoluteOrFixed = positionType === "absolute" || positionType === "fixed";
          const isFlexColumn = isFlexChild && parentFlexDir.startsWith("column");
          const isFlexRow = isFlexChild && !parentFlexDir.startsWith("column");

          // Horizontal group: absolute/fixed, grid child, or flex-column child (cross axis)
          const hEnabled = isAbsoluteOrFixed || isGridChild || isFlexColumn;
          // Vertical group: absolute/fixed, grid child, or flex-row child (cross axis)
          const vEnabled = isAbsoluteOrFixed || isGridChild || isFlexRow;

          const onHClick = (alignment: "start" | "center" | "end") => {
            if (isAbsoluteOrFixed) {
              if (alignment === "start") alignLeft();
              else if (alignment === "center") alignCenterH();
              else alignRight();
            } else if (isGridChild) {
              onPropertyChange("justifySelf", alignment);
            } else if (isFlexColumn) {
              onPropertyChange("alignSelf", alignment === "start" ? "flex-start" : alignment === "end" ? "flex-end" : "center");
            }
          };

          const onVClick = (alignment: "start" | "center" | "end") => {
            if (isAbsoluteOrFixed) {
              if (alignment === "start") alignTop();
              else if (alignment === "center") alignCenterV();
              else alignBottom();
            } else if (isGridChild) {
              onPropertyChange("alignSelf", alignment);
            } else if (isFlexRow) {
              onPropertyChange("alignSelf", alignment === "start" ? "flex-start" : alignment === "end" ? "flex-end" : "center");
            }
          };

          return (
            <Row>
              <div className="retune-field">
                <span className="retune-field-label">Alignment</span>
                <div className="retune-align-row">
                  <div className="retune-btn-group" style={!hEnabled ? { opacity: 0.3, pointerEvents: "none" } : undefined}>
                    <Tooltip content="Align left" side="top"><button type="button" className="retune-align-btn" onClick={() => onHClick("start")}><LayoutAlignLeft /></button></Tooltip>
                    <Tooltip content="Align center horizontally" side="top"><button type="button" className="retune-align-btn" onClick={() => onHClick("center")}><LayoutAlignHorizontalCenter /></button></Tooltip>
                    <Tooltip content="Align right" side="top"><button type="button" className="retune-align-btn" onClick={() => onHClick("end")}><LayoutAlignRight /></button></Tooltip>
                  </div>
                  <div className="retune-btn-group" style={!vEnabled ? { opacity: 0.3, pointerEvents: "none" } : undefined}>
                    <Tooltip content="Align top" side="top"><button type="button" className="retune-align-btn" onClick={() => onVClick("start")}><LayoutAlignTop /></button></Tooltip>
                    <Tooltip content="Align center vertically" side="top"><button type="button" className="retune-align-btn" onClick={() => onVClick("center")}><LayoutAlignVerticalCenter /></button></Tooltip>
                    <Tooltip content="Align bottom" side="top"><button type="button" className="retune-align-btn" onClick={() => onVClick("end")}><LayoutAlignBottom /></button></Tooltip>
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
              <NumberInput label="T" prop="top" value={s.top} onChange={onPropertyChange} />
              <NumberInput label="R" prop="right" value={s.right} onChange={onPropertyChange} />
            </div>
            <div className="retune-row">
              <NumberInput label="B" prop="bottom" value={s.bottom} onChange={onPropertyChange} />
              <NumberInput label="L" prop="left" value={s.left} onChange={onPropertyChange} />
            </div>
          </RowGroup>
        )}
        {isSticky && (
          <RowGroup label="Sticky offset">
            <div className="retune-row">
              <NumberInput label="T" prop="top" value={s.top} onChange={onPropertyChange} />
              <NumberInput label="B" prop="bottom" value={s.bottom} onChange={onPropertyChange} />
            </div>
          </RowGroup>
        )}
      </Section>

      {/* Layout */}
      <Section label="Layout">
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
            <Row>
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
                  />
                </Field>
              </div>
            </Row>
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
                  <NumberInput label={<Tooltip content="Horizontal gap between columns" side="top" sideOffset={14}><AlSpacingHorizontal /></Tooltip>} prop="columnGap" value={s.columnGap} onChange={onPropertyChange} min={0} />
                  <NumberInput label={<Tooltip content="Vertical gap between rows" side="top" sideOffset={14}><AlSpacingVertical /></Tooltip>} prop="rowGap" value={s.rowGap} onChange={onPropertyChange} min={0} />
                </div>
              </Field>
            </div>
          </Row>
        )}
        <RowGroup label="Padding">
          {paddingExpanded ? (
            <>
              <div className="retune-row">
                <div onPointerEnter={() => onPropertyHover?.("paddingTop")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
                  <NumberInput label={<Tooltip content="Padding top" side="top" sideOffset={14}><AlPaddingTop /></Tooltip>} prop="paddingTop" value={s.paddingTop} onChange={onPropertyChange} min={0} />
                </div>
                <div onPointerEnter={() => onPropertyHover?.("paddingRight")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
                  <NumberInput label={<Tooltip content="Padding right" side="top" sideOffset={14}><AlPaddingRight /></Tooltip>} prop="paddingRight" value={s.paddingRight} onChange={onPropertyChange} min={0} />
                </div>
                <Tooltip content="Collapse to axes" side="top">
                  <button className="retune-split-btn active" onClick={() => setPaddingExpanded(false)}>
                    <AlPaddingSides />
                  </button>
                </Tooltip>
              </div>
              <div className="retune-row">
                <div onPointerEnter={() => onPropertyHover?.("paddingBottom")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
                  <NumberInput label={<Tooltip content="Padding bottom" side="top" sideOffset={14}><AlPaddingBottom /></Tooltip>} prop="paddingBottom" value={s.paddingBottom} onChange={onPropertyChange} min={0} />
                </div>
                <div onPointerEnter={() => onPropertyHover?.("paddingLeft")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
                  <NumberInput label={<Tooltip content="Padding left" side="top" sideOffset={14}><AlPaddingLeft /></Tooltip>} prop="paddingLeft" value={s.paddingLeft} onChange={onPropertyChange} min={0} />
                </div>
                <div style={{ width: 32 }} />
              </div>
            </>
          ) : (
            <div className="retune-row">
              <div style={{ flex: 1 }} onPointerEnter={() => onPropertyHover?.("paddingBlock")} onPointerLeave={() => onPropertyHover?.(null)}>
                <ShorthandInput
                  label={<Tooltip content="Vertical padding (top, bottom)" side="top" sideOffset={14}><AlPaddingVertical /></Tooltip>}
                  props={["paddingTop", "paddingBottom"]}
                  values={[s.paddingTop, s.paddingBottom]}
                  onChange={onPropertyChange}
                  min={0}
                />
              </div>
              <div style={{ flex: 1 }} onPointerEnter={() => onPropertyHover?.("paddingInline")} onPointerLeave={() => onPropertyHover?.(null)}>
                <ShorthandInput
                  label={<Tooltip content="Horizontal padding (left, right)" side="top" sideOffset={14}><AlPaddingHorizontal /></Tooltip>}
                  props={["paddingLeft", "paddingRight"]}
                  values={[s.paddingLeft, s.paddingRight]}
                  onChange={onPropertyChange}
                  min={0}
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
                <div onPointerEnter={() => onPropertyHover?.("marginTop")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
                  <NumberInput label={<Tooltip content="Margin top" side="top" sideOffset={14}><AlPaddingTop /></Tooltip>} prop="marginTop" value={s.marginTop} onChange={onPropertyChange} />
                </div>
                <div onPointerEnter={() => onPropertyHover?.("marginRight")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
                  <NumberInput label={<Tooltip content="Margin right" side="top" sideOffset={14}><AlPaddingRight /></Tooltip>} prop="marginRight" value={s.marginRight} onChange={onPropertyChange} />
                </div>
                <Tooltip content="Collapse to axes" side="top">
                  <button className="retune-split-btn active" onClick={() => setMarginExpanded(false)}>
                    <AlPaddingSides />
                  </button>
                </Tooltip>
              </div>
              <div className="retune-row">
                <div onPointerEnter={() => onPropertyHover?.("marginBottom")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
                  <NumberInput label={<Tooltip content="Margin bottom" side="top" sideOffset={14}><AlPaddingBottom /></Tooltip>} prop="marginBottom" value={s.marginBottom} onChange={onPropertyChange} />
                </div>
                <div onPointerEnter={() => onPropertyHover?.("marginLeft")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
                  <NumberInput label={<Tooltip content="Margin left" side="top" sideOffset={14}><AlPaddingLeft /></Tooltip>} prop="marginLeft" value={s.marginLeft} onChange={onPropertyChange} />
                </div>
                <div style={{ width: 32 }} />
              </div>
            </>
          ) : (
            <div className="retune-row">
              <div style={{ flex: 1 }} onPointerEnter={() => onPropertyHover?.("marginBlock")} onPointerLeave={() => onPropertyHover?.(null)}>
                <ShorthandInput
                  label={<Tooltip content="Vertical margin (top, bottom)" side="top" sideOffset={14}><AlPaddingVertical /></Tooltip>}
                  props={["marginTop", "marginBottom"]}
                  values={[s.marginTop, s.marginBottom]}
                  onChange={onPropertyChange}
                />
              </div>
              <div style={{ flex: 1 }} onPointerEnter={() => onPropertyHover?.("marginInline")} onPointerLeave={() => onPropertyHover?.(null)}>
                <ShorthandInput
                  label={<Tooltip content="Horizontal margin (left, right)" side="top" sideOffset={14}><AlPaddingHorizontal /></Tooltip>}
                  props={["marginLeft", "marginRight"]}
                  values={[s.marginLeft, s.marginRight]}
                  onChange={onPropertyChange}
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
      </Section>

      {/* Size */}
      <Section
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
              value={s.width}
              options={SIZE_OPTIONS}
              onChange={(prop, val) => {
                if (val === "__fill") handleSizingModeChange("width", "fill");
                else if (val === "__hug") handleSizingModeChange("width", "hug");
                else {
                  if (isFlexChild) handleSizingModeChange("width", "fixed");
                  onPropertyChange(prop, val);
                }
              }}
            />
          </Field>
          <Field label="Height">
            <ComboInput
              prop="height"
              value={s.height}
              options={SIZE_OPTIONS}
              onChange={(prop, val) => {
                if (val === "__fill") handleSizingModeChange("height", "fill");
                else if (val === "__hug") handleSizingModeChange("height", "hug");
                else {
                  if (isFlexChild) handleSizingModeChange("height", "fixed");
                  onPropertyChange(prop, val);
                }
              }}
            />
          </Field>
        </Row>
        {visibleSizeExtras.has("min") && (
          <Row>
            <Field label="Min W">
              <NumberInput prop="minWidth" value={s.minWidth === "0px" || s.minWidth === "auto" ? "" : s.minWidth} placeholder="–" onChange={(p, v) => {
                if (!v) onPropertyChange(p, "0px");
                else onPropertyChange(p, v);
              }} />
            </Field>
            <Field label="Min H">
              <NumberInput prop="minHeight" value={s.minHeight === "0px" || s.minHeight === "auto" ? "" : s.minHeight} placeholder="–" onChange={(p, v) => {
                if (!v) onPropertyChange(p, "0px");
                else onPropertyChange(p, v);
              }} />
            </Field>
          </Row>
        )}
        {visibleSizeExtras.has("max") && (
          <Row>
            <Field label="Max W">
              <NumberInput prop="maxWidth" value={s.maxWidth === "none" ? "" : s.maxWidth} placeholder="–" onChange={(p, v) => {
                if (!v) onPropertyChange(p, "none");
                else onPropertyChange(p, v);
              }} />
            </Field>
            <Field label="Max H">
              <NumberInput prop="maxHeight" value={s.maxHeight === "none" ? "" : s.maxHeight} placeholder="–" onChange={(p, v) => {
                if (!v) onPropertyChange(p, "none");
                else onPropertyChange(p, v);
              }} />
            </Field>
          </Row>
        )}
      </Section>

      {/* Typography */}
      {isText && (
        <Section label="Typography">
          <Row>
            <Field label="Font">
              <FontInput prop="fontFamily" value={s.fontFamily} onChange={onPropertyChange} />
            </Field>
          </Row>
          <Row>
            <Field label="Size">
              <NumberInput prop="fontSize" value={s.fontSize} onChange={onPropertyChange} min={1} />
            </Field>
            <Field label="Weight">
              <ComboInput prop="fontWeight" value={s.fontWeight} options={FONT_WEIGHT_OPTIONS} onChange={onPropertyChange} />
            </Field>
          </Row>
          <Row>
            <Field label="Line height">
              <ComboInput prop="lineHeight" value={s.lineHeight} options={LINE_HEIGHT_OPTIONS} onChange={onPropertyChange} />
            </Field>
            <Field label="Letter spacing">
              <ComboInput prop="letterSpacing" value={s.letterSpacing} options={LETTER_SPACING_OPTIONS} onChange={onPropertyChange} />
            </Field>
          </Row>
          <Row>
            <Field label="Color">
              <ColorInput prop="color" value={s.color} onChange={onPropertyChange} />
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

      {/* Appearance */}
      <Section label="Appearance">
        <Row>
          <Field label="Opacity">
            <NumberInput prop="opacity" value={s.opacity} onChange={onPropertyChange} min={0} max={1} step={0.01} />
          </Field>
          <Field label="Z index">
            <NumberInput prop="zIndex" value={s.zIndex} onChange={onPropertyChange} />
          </Field>
        </Row>
        <RowGroup label="Corner radius">
          {radiusExpanded ? (
            <>
              <div className="retune-row">
                <NumberInput label={<Tooltip content="Top left corner radius" side="top" sideOffset={14}><RadiusTopLeft /></Tooltip>} prop="borderTopLeftRadius" value={s.borderTopLeftRadius} onChange={onPropertyChange} min={0} />
                <NumberInput label={<Tooltip content="Top right corner radius" side="top" sideOffset={14}><RadiusTopRight /></Tooltip>} prop="borderTopRightRadius" value={s.borderTopRightRadius} onChange={onPropertyChange} min={0} />
                <Tooltip content="Collapse to single" side="top">
                  <button className="retune-split-btn active" onClick={() => setRadiusExpanded(false)}>
                    <AlPaddingSides />
                  </button>
                </Tooltip>
              </div>
              <div className="retune-row">
                <NumberInput label={<Tooltip content="Bottom left corner radius" side="top" sideOffset={14}><RadiusBottomLeft /></Tooltip>} prop="borderBottomLeftRadius" value={s.borderBottomLeftRadius} onChange={onPropertyChange} min={0} />
                <NumberInput label={<Tooltip content="Bottom right corner radius" side="top" sideOffset={14}><RadiusBottomRight /></Tooltip>} prop="borderBottomRightRadius" value={s.borderBottomRightRadius} onChange={onPropertyChange} min={0} />
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
      </Section>

      {/* Fill */}
      <Section
        label="Fill"
        gap={8}
        action={
          hasFill ? (
            <Tooltip content="Remove fill" side="top"><button className="retune-section-action" onClick={handleRemoveFill}><Minus /></button></Tooltip>
          ) : (
            <Tooltip content="Add fill" side="top"><button className="retune-section-action" onClick={handleAddFill}><Plus /></button></Tooltip>
          )
        }
      >
        {hasFill && (
          <>
            <Row>
              <SelectInput
                prop="fillMode"
                value={fillMode === "solid" ? "solid" : gradient.type}
                options={["solid", "linear", "radial", "conic"]}
                onChange={handleFillModeChange}
              />
            </Row>
            {fillMode === "solid" ? (
              <Row>
                <ColorInput prop="backgroundColor" value={s.backgroundColor} onChange={onPropertyChange} />
              </Row>
            ) : (
              <GradientEditor gradient={gradient} onChange={handleGradientChange} />
            )}
          </>
        )}
      </Section>

      {/* Border */}
      <Section
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
                <ColorInput prop="borderColor" value={s.borderTopColor || s.borderRightColor || s.borderBottomColor || s.borderLeftColor} onChange={onPropertyChange} />
              </Field>
            </Row>
            {borderExpanded ? (
              <>
                <Row>
                  <Field label="Top">
                    <NumberInput prop="borderTopWidth" value={s.borderTopWidth} onChange={onPropertyChange} min={0} />
                  </Field>
                  <Field label="Right">
                    <NumberInput prop="borderRightWidth" value={s.borderRightWidth} onChange={onPropertyChange} min={0} />
                  </Field>
                </Row>
                <Row>
                  <Field label="Bottom">
                    <NumberInput prop="borderBottomWidth" value={s.borderBottomWidth} onChange={onPropertyChange} min={0} />
                  </Field>
                  <Field label="Left">
                    <NumberInput prop="borderLeftWidth" value={s.borderLeftWidth} onChange={onPropertyChange} min={0} />
                  </Field>
                </Row>
              </>
            ) : (
              <Row>
                <Field label="Width">
                  <ShorthandInput
                    props={["borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"]}
                    values={[s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth]}
                    onChange={onPropertyChange}
                    min={0}
                  />
                </Field>
                <Field label="Style">
                  <SelectInput prop="borderStyle" value={s.borderTopStyle !== "none" ? s.borderTopStyle : s.borderRightStyle !== "none" ? s.borderRightStyle : s.borderBottomStyle !== "none" ? s.borderBottomStyle : s.borderLeftStyle} options={["solid", "dashed", "dotted", "double", "groove", "ridge"]} onChange={onPropertyChange} />
                </Field>
                <Tooltip content="Edit individual sides" side="top">
                  <button className="retune-split-btn" onClick={() => setBorderExpanded(true)}>
                    <AlPaddingSides />
                  </button>
                </Tooltip>
              </Row>
            )}
          </>
        )}
      </Section>

      {/* Shadow */}
      <Section
        label="Shadow"
        action={
          hasShadow ? (
            <Tooltip content="Remove shadow" side="top"><button className="retune-section-action" onClick={handleRemoveShadow}><Minus /></button></Tooltip>
          ) : (
            <Tooltip content="Add shadow" side="top"><button className="retune-section-action" onClick={handleAddShadow}><Plus /></button></Tooltip>
          )
        }
      >
        {hasShadow && (() => {
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
                  />
                </Field>
              </Row>
              <Row>
                <Field label="X offset">
                  <NumberInput
                    prop="shadowOffsetX"
                    value={`${shadow.offsetX}px`}
                    onChange={(_p, val) => handleShadowFieldChange("offsetX", parseFloat(val) || 0)}
                  />
                </Field>
                <Field label="Y offset">
                  <NumberInput
                    prop="shadowOffsetY"
                    value={`${shadow.offsetY}px`}
                    onChange={(_p, val) => handleShadowFieldChange("offsetY", parseFloat(val) || 0)}
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
                  />
                </Field>
                <Field label="Spread">
                  <NumberInput
                    prop="shadowSpread"
                    value={`${shadow.spread}px`}
                    onChange={(_p, val) => handleShadowFieldChange("spread", parseFloat(val) || 0)}
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
        })()}
      </Section>

      {/* Filters */}
      <Section
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
      </Section>
      <div ref={filterSectionRef} />
    </>
  );
}

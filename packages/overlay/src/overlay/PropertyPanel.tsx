/**
 * PropertyPanel — the right-side inspector panel showing
 * editable properties for the selected element.
 */

import { useState, useCallback, useRef } from "react";
import type { InspectedElement } from "../types";
import type { BoxModelProperty } from "../ui/box-model-overlay";
import { Section, Row, RowGroup, Field } from "../ui/section";
import { NumberInput } from "../ui/number-input";
import { ComboInput, type ComboOption } from "../ui/combo-input";
import { ColorInput } from "../ui/color-input";
import { SelectInput } from "../ui/select-input";
import { SliderInput } from "../ui/slider-input";
import { TextInput } from "../ui/text-input";
import { FontInput } from "../ui/font-input";
import { ConstraintsInput, type PinState } from "../ui/constraints-input";
import { AlignmentGrid } from "../ui/alignment-grid";
import { GridPicker, parseGridCount } from "../ui/grid-picker";
import { GradientEditor } from "../ui/gradient-editor";
import { type FillMode, type GradientFill, detectFillMode, defaultGradient, parseCssGradient, gradientToCss } from "../ui/gradient-utils";
import { computeSizingChanges, type SizingMode } from "../ui/sizing-utils";
import {
  IconSpacingVerticalTop, IconSpacingVerticalBottom,
  IconSpacingHorizontalLeft, IconSpacingHorizontalRight,
  IconGapHorizontal, IconGapVertical,
} from "../ui/spacing-icons";
import { SegmentedControl } from "../ui/segmented-control";
import { detectTruncation, computeTruncationChanges } from "../ui/truncation-utils";
import type { SegmentedOption } from "../ui/segmented-control";
import { IconAlignmentLeft } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconAlignmentLeft";
import { IconAlignmentCenter } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconAlignmentCenter";
import { IconAlignmentRight } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconAlignmentRight";
import { IconVerticalAlignmentLeft } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconVerticalAlignmentLeft";
import { IconVerticalAlignmentCenter } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconVerticalAlignmentCenter";
import { IconVerticalAlignmentRight } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconVerticalAlignmentRight";
import { IconHorizontalAlignmentTop } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconHorizontalAlignmentTop";
import { IconHorizontalAlignmentCenter } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconHorizontalAlignmentCenter";
import { IconHorizontalAlignmentBottom } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconHorizontalAlignmentBottom";
import { IconFormSquare } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconFormSquare";
import { IconCornerRadius } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconCornerRadius";
import { IconBento } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconBento";
import { IconLayoutGrid2 } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconLayoutGrid2";
import { IconPlusLarge } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconPlusLarge";
import { IconMinusLarge } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconMinusLarge";
import { Tooltip } from "../ui/tooltip";
import { parseBoxShadow, shadowToCss, defaultShadow, type ShadowValue } from "../ui/shadow-utils";

const TEXT_ALIGN_OPTIONS: SegmentedOption[] = [
  { value: "left", icon: <IconAlignmentLeft size={16} />, label: "Left" },
  { value: "center", icon: <IconAlignmentCenter size={16} />, label: "Center" },
  { value: "right", icon: <IconAlignmentRight size={16} />, label: "Right" },
];

const VERTICAL_ALIGN_OPTIONS: SegmentedOption[] = [
  { value: "top", icon: <IconHorizontalAlignmentTop size={16} />, label: "Top" },
  { value: "middle", icon: <IconHorizontalAlignmentCenter size={16} />, label: "Middle" },
  { value: "bottom", icon: <IconHorizontalAlignmentBottom size={16} />, label: "Bottom" },
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




const DISPLAY_OPTIONS: SegmentedOption[] = [
  { value: "block", icon: <IconFormSquare size={20} />, label: "Block" },
  { value: "flex", icon: <IconBento size={20} />, label: "Flex" },
  { value: "grid", icon: <IconLayoutGrid2 size={20} />, label: "Grid" },
];

export function PropertyPanel({
  element,
  position,
  onPropertyChange,
  onPropertyHover,
  onApplyToElement,
}: {
  element: InspectedElement;
  position: "left" | "right";
  onPropertyChange: (property: string, value: string) => void;
  onPropertyHover?: (property: BoxModelProperty) => void;
  onApplyToElement?: (element: Element, property: string, value: string) => void;
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
  const hasBorder = s.borderTopStyle !== "none" && parseFloat(s.borderTopWidth) > 0;

  const handleAddBorder = useCallback(() => {
    onPropertyChange("borderWidth", "1px");
    onPropertyChange("borderStyle", "solid");
    onPropertyChange("borderColor", "#000000");
  }, [onPropertyChange]);

  const handleRemoveBorder = useCallback(() => {
    onPropertyChange("borderWidth", "0px");
    onPropertyChange("borderStyle", "none");
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
    <div className={`composer-panel ${position}`}>
      {/* Header */}
      <div className="composer-panel-header">
        <div className="composer-el-tag">{element.tagName.toLowerCase()}</div>
        {element.reactComponents.length > 0 && (
          <div className="composer-el-component">{element.reactComponents.join(" \u203A ")}</div>
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
              <div className="composer-field">
                <span className="composer-field-label">Alignment</span>
                <div className="composer-align-row">
                  <div className="composer-btn-group" style={!hEnabled ? { opacity: 0.3, pointerEvents: "none" } : undefined}>
                    <Tooltip content="Align left" side="top"><button type="button" className="composer-align-btn" onClick={() => onHClick("start")}><IconVerticalAlignmentLeft size={16} /></button></Tooltip>
                    <Tooltip content="Align center horizontally" side="top"><button type="button" className="composer-align-btn" onClick={() => onHClick("center")}><IconVerticalAlignmentCenter size={16} /></button></Tooltip>
                    <Tooltip content="Align right" side="top"><button type="button" className="composer-align-btn" onClick={() => onHClick("end")}><IconVerticalAlignmentRight size={16} /></button></Tooltip>
                  </div>
                  <div className="composer-btn-group" style={!vEnabled ? { opacity: 0.3, pointerEvents: "none" } : undefined}>
                    <Tooltip content="Align top" side="top"><button type="button" className="composer-align-btn" onClick={() => onVClick("start")}><IconHorizontalAlignmentTop size={16} /></button></Tooltip>
                    <Tooltip content="Align center vertically" side="top"><button type="button" className="composer-align-btn" onClick={() => onVClick("center")}><IconHorizontalAlignmentCenter size={16} /></button></Tooltip>
                    <Tooltip content="Align bottom" side="top"><button type="button" className="composer-align-btn" onClick={() => onVClick("end")}><IconHorizontalAlignmentBottom size={16} /></button></Tooltip>
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
            <div className="composer-row">
              <NumberInput label="T" prop="top" value={s.top} onChange={onPropertyChange} />
              <NumberInput label="R" prop="right" value={s.right} onChange={onPropertyChange} />
            </div>
            <div className="composer-row">
              <NumberInput label="B" prop="bottom" value={s.bottom} onChange={onPropertyChange} />
              <NumberInput label="L" prop="left" value={s.left} onChange={onPropertyChange} />
            </div>
          </RowGroup>
        )}
        {isSticky && (
          <RowGroup label="Sticky offset">
            <div className="composer-row">
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
              value={displayValue.includes("flex") ? "flex" : displayValue.includes("grid") ? "grid" : "block"}
              onChange={(v) => onPropertyChange("display", v)}
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
                    label={<Tooltip content={(s.flexDirection || "row").startsWith("column") ? "Vertical gap between items" : "Horizontal gap between items"} side="top" sideOffset={14}>{(s.flexDirection || "row").startsWith("column") ? <IconGapVertical /> : <IconGapHorizontal />}</Tooltip>}
                    prop="gap"
                    value={s.gap}
                    onChange={onPropertyChange}
                  />
                </Field>
              </div>
            </Row>
            <Row>
              <Field label="Direction">
                <SelectInput prop="flexDirection" value={s.flexDirection} options={["row", "row-reverse", "column", "column-reverse"]} onChange={onPropertyChange} />
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
                  <NumberInput label={<Tooltip content="Horizontal gap between columns" side="top" sideOffset={14}><IconGapHorizontal /></Tooltip>} prop="columnGap" value={s.columnGap} onChange={onPropertyChange} />
                  <NumberInput label={<Tooltip content="Vertical gap between rows" side="top" sideOffset={14}><IconGapVertical /></Tooltip>} prop="rowGap" value={s.rowGap} onChange={onPropertyChange} />
                </div>
              </Field>
            </div>
          </Row>
        )}
        <RowGroup label="Padding">
          <div className="composer-row">
            <div onPointerEnter={() => onPropertyHover?.("paddingTop")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
              <NumberInput label={<Tooltip content="Padding top" side="top" sideOffset={14}><IconSpacingVerticalTop /></Tooltip>} prop="paddingTop" value={s.paddingTop} onChange={onPropertyChange} />
            </div>
            <div onPointerEnter={() => onPropertyHover?.("paddingRight")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
              <NumberInput label={<Tooltip content="Padding right" side="top" sideOffset={14}><IconSpacingHorizontalRight /></Tooltip>} prop="paddingRight" value={s.paddingRight} onChange={onPropertyChange} />
            </div>
          </div>
          <div className="composer-row">
            <div onPointerEnter={() => onPropertyHover?.("paddingBottom")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
              <NumberInput label={<Tooltip content="Padding bottom" side="top" sideOffset={14}><IconSpacingVerticalBottom /></Tooltip>} prop="paddingBottom" value={s.paddingBottom} onChange={onPropertyChange} />
            </div>
            <div onPointerEnter={() => onPropertyHover?.("paddingLeft")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
              <NumberInput label={<Tooltip content="Padding left" side="top" sideOffset={14}><IconSpacingHorizontalLeft /></Tooltip>} prop="paddingLeft" value={s.paddingLeft} onChange={onPropertyChange} />
            </div>
          </div>
        </RowGroup>
        <RowGroup label="Margin">
          <div className="composer-row">
            <div onPointerEnter={() => onPropertyHover?.("marginTop")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
              <NumberInput label={<Tooltip content="Margin top" side="top" sideOffset={14}><IconSpacingVerticalTop /></Tooltip>} prop="marginTop" value={s.marginTop} onChange={onPropertyChange} />
            </div>
            <div onPointerEnter={() => onPropertyHover?.("marginRight")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
              <NumberInput label={<Tooltip content="Margin right" side="top" sideOffset={14}><IconSpacingHorizontalRight /></Tooltip>} prop="marginRight" value={s.marginRight} onChange={onPropertyChange} />
            </div>
          </div>
          <div className="composer-row">
            <div onPointerEnter={() => onPropertyHover?.("marginBottom")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
              <NumberInput label={<Tooltip content="Margin bottom" side="top" sideOffset={14}><IconSpacingVerticalBottom /></Tooltip>} prop="marginBottom" value={s.marginBottom} onChange={onPropertyChange} />
            </div>
            <div onPointerEnter={() => onPropertyHover?.("marginLeft")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
              <NumberInput label={<Tooltip content="Margin left" side="top" sideOffset={14}><IconSpacingHorizontalLeft /></Tooltip>} prop="marginLeft" value={s.marginLeft} onChange={onPropertyChange} />
            </div>
          </div>
        </RowGroup>
      </Section>

      {/* Size */}
      <Section label="Size">
        <Row>
          <Field label="Width">
            <ComboInput
              label="W"
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
              label="H"
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
        <Row>
          <Field label="Min W">
            <NumberInput prop="minWidth" value={s.minWidth === "0px" || s.minWidth === "auto" ? "" : s.minWidth} placeholder="–" onChange={(p, v) => onPropertyChange(p, v || "0px")} />
          </Field>
          <Field label="Min H">
            <NumberInput prop="minHeight" value={s.minHeight === "0px" || s.minHeight === "auto" ? "" : s.minHeight} placeholder="–" onChange={(p, v) => onPropertyChange(p, v || "0px")} />
          </Field>
        </Row>
        <Row>
          <Field label="Max W">
            <NumberInput prop="maxWidth" value={s.maxWidth === "none" ? "" : s.maxWidth} placeholder="–" onChange={(p, v) => onPropertyChange(p, v || "none")} />
          </Field>
          <Field label="Max H">
            <NumberInput prop="maxHeight" value={s.maxHeight === "none" ? "" : s.maxHeight} placeholder="–" onChange={(p, v) => onPropertyChange(p, v || "none")} />
          </Field>
        </Row>
      </Section>

      {/* Grid Child — Placement */}
      {isGridChild && (
        <Section label="Grid placement">
          <Row>
            <Field label="Column">
              <TextInput prop="gridColumn" value={s.gridColumn} onChange={onPropertyChange} />
            </Field>
            <Field label="Row">
              <TextInput prop="gridRow" value={s.gridRow} onChange={onPropertyChange} />
            </Field>
          </Row>
        </Section>
      )}

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
              <NumberInput prop="fontSize" value={s.fontSize} onChange={onPropertyChange} />
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
          </Row>
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
          <Row>
            <Field label="Word spacing">
              <NumberInput prop="wordSpacing" value={s.wordSpacing} onChange={onPropertyChange} />
            </Field>
            <Field label="Text indent">
              <NumberInput prop="textIndent" value={s.textIndent} onChange={onPropertyChange} />
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

            // In grid/flex layouts, ancestors with min-width:auto prevent
            // truncation from working. Walk up and set min-width:0 on any
            // grid/flex children so they can shrink below content size.
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
                </Row>
              </>
            );
          })()}
        </Section>
      )}

      {/* Appearance */}
      <Section label="Appearance">
        <Row>
          <Field label="Opacity">
            <NumberInput prop="opacity" value={s.opacity} onChange={onPropertyChange} />
          </Field>
          <Field label="Z index">
            <NumberInput prop="zIndex" value={s.zIndex} onChange={onPropertyChange} />
          </Field>
        </Row>
        <RowGroup label="Corner radius">
          <div className="composer-row">
            <NumberInput label={<Tooltip content="Top left corner radius" side="top" sideOffset={14}><IconCornerRadius size={14} /></Tooltip>} prop="borderTopLeftRadius" value={s.borderTopLeftRadius} onChange={onPropertyChange} />
            <NumberInput label={<Tooltip content="Top right corner radius" side="top" sideOffset={14}><span style={{ display: "inline-flex", transform: "rotate(90deg)" }}><IconCornerRadius size={14} /></span></Tooltip>} prop="borderTopRightRadius" value={s.borderTopRightRadius} onChange={onPropertyChange} />
          </div>
          <div className="composer-row">
            <NumberInput label={<Tooltip content="Bottom left corner radius" side="top" sideOffset={14}><span style={{ display: "inline-flex", transform: "rotate(270deg)" }}><IconCornerRadius size={14} /></span></Tooltip>} prop="borderBottomLeftRadius" value={s.borderBottomLeftRadius} onChange={onPropertyChange} />
            <NumberInput label={<Tooltip content="Bottom right corner radius" side="top" sideOffset={14}><span style={{ display: "inline-flex", transform: "rotate(180deg)" }}><IconCornerRadius size={14} /></span></Tooltip>} prop="borderBottomRightRadius" value={s.borderBottomRightRadius} onChange={onPropertyChange} />
          </div>
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
            <Tooltip content="Remove fill" side="top"><button className="composer-section-action" onClick={handleRemoveFill}><IconMinusLarge size={20} /></button></Tooltip>
          ) : (
            <Tooltip content="Add fill" side="top"><button className="composer-section-action" onClick={handleAddFill}><IconPlusLarge size={20} /></button></Tooltip>
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
            <Tooltip content="Remove border" side="top"><button className="composer-section-action" onClick={handleRemoveBorder}><IconMinusLarge size={20} /></button></Tooltip>
          ) : (
            <Tooltip content="Add border" side="top"><button className="composer-section-action" onClick={handleAddBorder}><IconPlusLarge size={20} /></button></Tooltip>
          )
        }
      >
        {hasBorder && (
          <>
            <Row>
              <Field label="Color">
                <ColorInput prop="borderColor" value={s.borderTopColor} onChange={onPropertyChange} />
              </Field>
            </Row>
            <Row>
              <Field label="Width">
                <NumberInput prop="borderWidth" value={s.borderTopWidth} onChange={onPropertyChange} />
              </Field>
              <Field label="Style">
                <SelectInput prop="borderStyle" value={s.borderTopStyle} options={["solid", "dashed", "dotted", "double", "groove", "ridge"]} onChange={onPropertyChange} />
              </Field>
            </Row>
          </>
        )}
      </Section>

      {/* Shadow */}
      <Section
        label="Shadow"
        action={
          hasShadow ? (
            <Tooltip content="Remove shadow" side="top"><button className="composer-section-action" onClick={handleRemoveShadow}><IconMinusLarge size={20} /></button></Tooltip>
          ) : (
            <Tooltip content="Add shadow" side="top"><button className="composer-section-action" onClick={handleAddShadow}><IconPlusLarge size={20} /></button></Tooltip>
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

    </div>
  );
}

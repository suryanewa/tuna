/**
 * FillSection — Appearance, SVG Fill/Stroke, and CSS Fill (background color/gradient).
 *
 * Extracted from PropertyPanel.tsx (lines ~1651-1811).
 *
 * Contains three visual sub-sections:
 * 1. **Appearance** — Opacity, corner radius, overflow (hidden for SVG children)
 * 2. **SVG Fill & Stroke** — Simple color controls for SVG child shapes
 * 3. **Fill** — Background color / gradient for non-image, non-SVG elements
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { BaseSectionProps } from "./section-props";
import type { VariableMatch, DesignVariable } from "../../variables/types";
import { Section, Row, Field } from "../section";
import { NumberInput } from "../number-input";
import { ColorInput } from "../color-input";
import { SelectInput } from "../select-input";
import { ShorthandInput } from "../shorthand-input";
import { GradientEditor } from "../gradient-editor";
import { VariableAction } from "../variable-action";
import { Tooltip } from "../tooltip";
import {
  type FillMode, type GradientFill,
  detectFillMode, defaultGradient, parseCssGradient, gradientToCss,
} from "../gradient-utils";
import {
  RadiusTopLeft, RadiusTopRight, RadiusBottomLeft, RadiusBottomRight,
  AlPaddingSides, Plus, Minus,
} from "../icons";

export interface FillSectionProps extends Pick<
  BaseSectionProps,
  | "element"
  | "s"
  | "onPropertyChange"
  | "variableProps"
  | "shorthandVariableProps"
  | "changeProps"
  | "shorthandChangeProps"
  | "handleVariableSelect"
  | "handleVariableApply"
> {
  /** Whether the element is an SVG child shape (path, rect, circle, etc.) */
  isSvgChild: boolean;
  /** Whether the element is an image or video */
  isMedia: boolean;
  /** Get the variable/token match for a camelCase CSS property */
  getVariableMatch: (camelProp: string) => VariableMatch | undefined;
  /** Record a value-only token association (persisted in change tracker) */
  onVariableAssociate?: (properties: string[], token: { className: string; values: Record<string, string> }) => void;
  /** Reset a single property to its original value */
  onPropertyReset?: (property: string) => void;
}

export function FillSection({
  element,
  s,
  onPropertyChange,
  variableProps,
  shorthandVariableProps,
  changeProps,
  shorthandChangeProps,
  handleVariableSelect,
  handleVariableApply,
  isSvgChild,
  isMedia,
  getVariableMatch,
  onVariableAssociate,
  onPropertyReset,
}: FillSectionProps) {
  // ── Corner radius expand/collapse ──
  const [radiusExpanded, setRadiusExpanded] = useState(false);

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
  useEffect(() => {
    if (gradientEditingRef.current) {
      gradientEditingRef.current = false;
      return;
    }
    const newMode = detectFillMode(s.backgroundColor, s.backgroundImage);
    setFillMode(newMode);
    if (newMode !== "solid") {
      const parsed = parseCssGradient(s.backgroundImage || "");
      if (parsed) setGradient(parsed);
    }
  }, [s.backgroundColor, s.backgroundImage]);

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

  return (
    <>
      {/* Appearance (hidden for SVG child shapes) */}
      {!isSvgChild && (
        <Section label="Appearance">
          <Row>
            <Field label="Opacity">
              <NumberInput prop="opacity" value={s.opacity} onChange={onPropertyChange} min={0} max={1} step={0.01} {...variableProps("opacity")} {...changeProps("opacity")} />
            </Field>
            <Field label="Z index">
              <NumberInput prop="zIndex" value={s.zIndex} onChange={onPropertyChange} {...changeProps("zIndex")} />
            </Field>
          </Row>
          <Row label="Corner radius">
            {radiusExpanded ? (
              <>
                <div className="tuna-row">
                  <NumberInput label={<Tooltip content="Top left corner radius" side="top" sideOffset={14}><RadiusTopLeft /></Tooltip>} prop="borderTopLeftRadius" value={s.borderTopLeftRadius} onChange={onPropertyChange} min={0} {...variableProps("borderTopLeftRadius")} {...changeProps("borderTopLeftRadius")} />
                  <NumberInput label={<Tooltip content="Top right corner radius" side="top" sideOffset={14}><RadiusTopRight /></Tooltip>} prop="borderTopRightRadius" value={s.borderTopRightRadius} onChange={onPropertyChange} min={0} {...variableProps("borderTopRightRadius")} {...changeProps("borderTopRightRadius")} />
                  <Tooltip content="Collapse to single" side="top">
                    <button className="tuna-split-btn active" onClick={() => setRadiusExpanded(false)}>
                      <AlPaddingSides />
                    </button>
                  </Tooltip>
                </div>
                <div className="tuna-row">
                  <NumberInput label={<Tooltip content="Bottom left corner radius" side="top" sideOffset={14}><RadiusBottomLeft /></Tooltip>} prop="borderBottomLeftRadius" value={s.borderBottomLeftRadius} onChange={onPropertyChange} min={0} {...variableProps("borderBottomLeftRadius")} {...changeProps("borderBottomLeftRadius")} />
                  <NumberInput label={<Tooltip content="Bottom right corner radius" side="top" sideOffset={14}><RadiusBottomRight /></Tooltip>} prop="borderBottomRightRadius" value={s.borderBottomRightRadius} onChange={onPropertyChange} min={0} {...variableProps("borderBottomRightRadius")} {...changeProps("borderBottomRightRadius")} />
                  <div style={{ width: 32 }} />
                </div>
              </>
            ) : (
              <div className="tuna-row">
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
                  <button className="tuna-split-btn" onClick={() => setRadiusExpanded(true)}>
                    <AlPaddingSides />
                  </button>
                </Tooltip>
              </div>
            )}
          </Row>
          <Row>
            <Field label="Overflow">
              <SelectInput prop="overflow" value={s.overflow} options={["visible", "hidden", "auto", "scroll"]} onChange={onPropertyChange} />
            </Field>
          </Row>
        </Section>
      )}

      {/* SVG Fill — always visible for SVG child shapes */}
      {isSvgChild && (() => {
        const hasSvgFill = s.fill && s.fill !== "none" && s.fill !== "transparent";
        return (
          <Section label="Fill" action={
            hasSvgFill ? (
              <Tooltip content="Remove fill" side="top"><button className="tuna-section-action" onClick={() => onPropertyChange("fill", "none")}><Minus /></button></Tooltip>
            ) : (
              <Tooltip content="Add fill" side="top"><button className="tuna-section-action" onClick={() => onPropertyChange("fill", "#000000")}><Plus /></button></Tooltip>
            )
          }>
            {hasSvgFill && (
              <Row label="Color">
                <div className="tuna-row">
                  <ColorInput prop="fill" value={s.fill} onChange={onPropertyChange} {...variableProps("fill")} {...changeProps("fill")} />
                </div>
              </Row>
            )}
          </Section>
        );
      })()}

      {/* SVG Stroke — always visible for SVG child shapes */}
      {isSvgChild && (() => {
        const hasStrokeColor = s.stroke && s.stroke !== "none" && s.stroke !== "transparent";
        return (
          <Section label="Stroke" action={
            hasStrokeColor ? (
              <Tooltip content="Remove stroke" side="top"><button className="tuna-section-action" onClick={() => { onPropertyChange("stroke", "none"); }}><Minus /></button></Tooltip>
            ) : null
          }>
            <Row label="Color">
              <div className="tuna-row">
                <ColorInput prop="stroke" value={hasStrokeColor ? s.stroke : "transparent"} onChange={(prop, val) => {
                  onPropertyChange(prop, val);
                  if (!s.strokeWidth || s.strokeWidth === "0") onPropertyChange("strokeWidth", "1");
                }} {...variableProps("stroke")} {...changeProps("stroke")} />
              </div>
            </Row>
            <Row label="Width">
              <div className="tuna-row">
                <NumberInput label="" prop="strokeWidth" value={s.strokeWidth || "0"} onChange={onPropertyChange} min={0} step={0.5} {...variableProps("strokeWidth")} {...changeProps("strokeWidth")} />
              </div>
            </Row>
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
                  <Tooltip content="Remove fill" side="top"><button className="tuna-section-action" onClick={handleRemoveFill}><Minus /></button></Tooltip>
                ) : (
                  <Tooltip content="Add fill" side="top"><button className="tuna-section-action" onClick={handleAddFill}><Plus /></button></Tooltip>
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
    </>
  );
}

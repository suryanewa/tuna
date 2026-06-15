/**
 * BorderSection — Border color, width, style, and corner radius controls.
 *
 * Extracted from PropertyPanel.tsx (lines ~1985-2067).
 *
 * Supports:
 * - Add/remove border toggle
 * - Border color picker
 * - Border width: collapsed shorthand (2-axis) or expanded (4-sides)
 * - Border style selector
 */

import { useState, useCallback } from "react";
import type { BaseSectionProps } from "./section-props";
import { Section, Row, Field } from "../section";
import { NumberInput } from "../number-input";
import { ColorInput } from "../color-input";
import { SelectInput } from "../select-input";
import { ShorthandInput } from "../shorthand-input";
import { Tooltip } from "../tooltip";
import { AlPaddingSides, Plus, Minus } from "../icons";

export interface BorderSectionProps extends Pick<
  BaseSectionProps,
  | "s"
  | "onPropertyChange"
  | "variableProps"
  | "shorthandVariableProps"
  | "changeProps"
  | "shorthandChangeProps"
> {}

export function BorderSection({
  s,
  onPropertyChange,
  variableProps,
  shorthandVariableProps,
  changeProps,
  shorthandChangeProps,
}: BorderSectionProps) {
  // ── Border state ──
  const borderSides = [
    { width: s.borderTopWidth, style: s.borderTopStyle },
    { width: s.borderRightWidth, style: s.borderRightStyle },
    { width: s.borderBottomWidth, style: s.borderBottomStyle },
    { width: s.borderLeftWidth, style: s.borderLeftStyle },
  ];
  const hasBorder = borderSides.some((side) => side.style !== "none" && parseFloat(side.width) > 0);
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

  return (
    <Section
      label="Border"
      action={
        hasBorder ? (
          <Tooltip content="Remove border" side="top"><button className="tuna-section-action" onClick={handleRemoveBorder}><Minus /></button></Tooltip>
        ) : (
          <Tooltip content="Add border" side="top"><button className="tuna-section-action" onClick={handleAddBorder}><Plus /></button></Tooltip>
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
          {borderExpanded ? (
            <>
              <div className="tuna-section-row">
                <div className="tuna-row">
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
                    <button className="tuna-split-btn active" onClick={() => setBorderExpanded(false)}>
                      <AlPaddingSides />
                    </button>
                  </Tooltip>
                </div>
              </div>
              <div className="tuna-section-row">
                <div className="tuna-row">
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
                </div>
              </div>
            </>
          ) : (
            <Row label="Width">
              <div className="tuna-row">
                <ShorthandInput
                  props={["borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"]}
                  values={[s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth]}
                  onChange={onPropertyChange}
                  min={0}
                  {...shorthandVariableProps(["borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"])}
                  {...shorthandChangeProps(["borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"])}
                />
                <Tooltip content="Edit individual sides" side="top">
                  <button className="tuna-split-btn" onClick={() => setBorderExpanded(true)}>
                    <AlPaddingSides />
                  </button>
                </Tooltip>
              </div>
            </Row>
          )}
          <Row>
            <Field label="Style">
              <SelectInput prop="borderStyle" value={s.borderTopStyle !== "none" ? s.borderTopStyle : s.borderRightStyle !== "none" ? s.borderRightStyle : s.borderBottomStyle !== "none" ? s.borderBottomStyle : s.borderLeftStyle} options={["solid", "dashed", "dotted", "double", "groove", "ridge"]} onChange={onPropertyChange} />
            </Field>
          </Row>
        </>
      )}
    </Section>
  );
}

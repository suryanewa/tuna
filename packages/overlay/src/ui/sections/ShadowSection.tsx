/**
 * ShadowSection -- box shadow controls: color, X/Y offset, blur, spread, inset toggle.
 *
 * Extracted from PropertyPanel.tsx lines 2068-2187.
 */

import { useCallback } from "react";
import type { BaseSectionProps } from "./section-props";
import type { ShadowValue } from "../shadow-utils";
import { parseBoxShadow, shadowToCss, defaultShadow } from "../shadow-utils";
import { Section, Row, Field } from "../section";
import { NumberInput } from "../number-input";
import { ColorInput } from "../color-input";
import { SelectInput } from "../select-input";
import { VariableAction } from "../variable-action";
import { ChangeIndicator } from "../change-indicator";
import { Tooltip } from "../tooltip";
import { Plus, Minus } from "../icons";

export interface ShadowSectionProps extends BaseSectionProps {}

export function ShadowSection({
  s,
  onPropertyChange,
  variableProps,
  changeProps,
  handleVariableSelect,
  handleVariableApply,
}: ShadowSectionProps) {
  // ── Derived state ──
  const hasShadow = s.boxShadow && s.boxShadow !== "none";

  // Variable detection for boxShadow
  const shadowVarPropsObj = variableProps("boxShadow");
  const shadowVarMatch = shadowVarPropsObj.variableMatch;
  const shadowHasVariable = !!shadowVarMatch;

  // ── Callbacks ──
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

  return (
    <Section
      label="Shadow"
      action={
        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
          {!shadowHasVariable && (
            <VariableAction
              property="boxShadow"
              onVariableSelect={handleVariableSelect}
              onVariableApply={(v, props) => handleVariableApply(v, props)}
            />
          )}
          {hasShadow || shadowHasVariable ? (
            <Tooltip content="Remove shadow" side="top"><button className="tuna-section-action" onClick={handleRemoveShadow}><Minus /></button></Tooltip>
          ) : (
            <Tooltip content="Add shadow" side="top"><button className="tuna-section-action" onClick={handleAddShadow}><Plus /></button></Tooltip>
          )}
        </div>
      }
    >
      {shadowHasVariable ? (() => {
        const shadowPickerRef = { current: null as (() => void) | null };
        return (
          <Row>
            <div className="tuna-prop tuna-prop-variable-applied" style={{ flex: 1, cursor: "pointer" }} onClick={() => shadowPickerRef.current?.()}>
              <ChangeIndicator isChanged={changeProps("boxShadow").isChanged} onReset={changeProps("boxShadow").onReset} />
              <span className="tuna-prop-input" style={{ display: "flex", alignItems: "center", paddingLeft: 12, color: "var(--tuna-text)" }}>
                {shadowVarMatch.variable.className.startsWith("var(--")
                  ? shadowVarMatch.variable.className.slice(6, -1)
                  : shadowVarMatch.variable.className}
              </span>
              <VariableAction
                match={shadowVarMatch}
                property="boxShadow"
                onVariableSelect={handleVariableSelect}
                onVariableApply={handleVariableApply}
                onVariableUnlink={shadowVarPropsObj.onVariableUnlink}
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
}

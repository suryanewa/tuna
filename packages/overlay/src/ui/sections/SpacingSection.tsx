/**
 * SpacingSection — Padding and Margin controls with expand/collapse toggle.
 *
 * Extracted from PropertyPanel.tsx (lines ~1155-1270).
 * Both padding and margin support a collapsed 2-axis mode (horizontal/vertical)
 * and an expanded 4-sides mode (left, top, right, bottom).
 */

import { useState } from "react";
import type { BaseSectionProps } from "./section-props";
import { Section, Row } from "../section";
import { NumberInput } from "../number-input";
import { ShorthandInput } from "../shorthand-input";
import { Tooltip } from "../tooltip";
import {
  AlPaddingTop, AlPaddingBottom, AlPaddingLeft, AlPaddingRight,
  AlPaddingHorizontal, AlPaddingVertical, AlPaddingSides,
} from "../icons";

export interface SpacingSectionProps extends Pick<
  BaseSectionProps,
  "s" | "onPropertyChange" | "onPropertyHover" | "variableProps" | "shorthandVariableProps" | "changeProps" | "shorthandChangeProps"
> {}

export function SpacingSection({
  s,
  onPropertyChange,
  onPropertyHover,
  variableProps,
  shorthandVariableProps,
  changeProps,
  shorthandChangeProps,
}: SpacingSectionProps) {
  const [paddingExpanded, setPaddingExpanded] = useState(false);
  const [marginExpanded, setMarginExpanded] = useState(false);

  return (
    <Section label="Spacing">
      <Row label="Padding">
        {paddingExpanded ? (
          <>
            <div className="tuna-row">
              <div onPointerEnter={() => onPropertyHover?.("paddingLeft")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
                <NumberInput label={<Tooltip content="Padding left" side="top" sideOffset={14}><AlPaddingLeft /></Tooltip>} prop="paddingLeft" value={s.paddingLeft} onChange={onPropertyChange} min={0} {...variableProps("paddingLeft")} {...changeProps("paddingLeft")} />
              </div>
              <div onPointerEnter={() => onPropertyHover?.("paddingTop")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
                <NumberInput label={<Tooltip content="Padding top" side="top" sideOffset={14}><AlPaddingTop /></Tooltip>} prop="paddingTop" value={s.paddingTop} onChange={onPropertyChange} min={0} {...variableProps("paddingTop")} {...changeProps("paddingTop")} />
              </div>
              <Tooltip content="Collapse to axes" side="top">
                <button className="tuna-split-btn active" onClick={() => setPaddingExpanded(false)}>
                  <AlPaddingSides />
                </button>
              </Tooltip>
            </div>
            <div className="tuna-row">
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
          <div className="tuna-row">
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
              <button className="tuna-split-btn" onClick={() => setPaddingExpanded(true)}>
                <AlPaddingSides />
              </button>
            </Tooltip>
          </div>
        )}
      </Row>
      <Row label="Margin">
        {marginExpanded ? (
          <>
            <div className="tuna-row">
              <div onPointerEnter={() => onPropertyHover?.("marginLeft")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
                <NumberInput label={<Tooltip content="Margin left" side="top" sideOffset={14}><AlPaddingLeft /></Tooltip>} prop="marginLeft" value={s.marginLeft} onChange={onPropertyChange} {...variableProps("marginLeft")} {...changeProps("marginLeft")} />
              </div>
              <div onPointerEnter={() => onPropertyHover?.("marginTop")} onPointerLeave={() => onPropertyHover?.(null)} style={{ flex: 1 }}>
                <NumberInput label={<Tooltip content="Margin top" side="top" sideOffset={14}><AlPaddingTop /></Tooltip>} prop="marginTop" value={s.marginTop} onChange={onPropertyChange} {...variableProps("marginTop")} {...changeProps("marginTop")} />
              </div>
              <Tooltip content="Collapse to axes" side="top">
                <button className="tuna-split-btn active" onClick={() => setMarginExpanded(false)}>
                  <AlPaddingSides />
                </button>
              </Tooltip>
            </div>
            <div className="tuna-row">
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
          <div className="tuna-row">
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
              <button className="tuna-split-btn" onClick={() => setMarginExpanded(true)}>
                <AlPaddingSides />
              </button>
            </Tooltip>
          </div>
        )}
      </Row>
    </Section>
  );
}

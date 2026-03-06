/**
 * PropertyPanel — the right-side inspector panel showing
 * editable properties for the selected element.
 */

import type { InspectedElement } from "../types";
import { Section, Row, RowGroup, Field } from "../ui/section";
import { NumberInput } from "../ui/number-input";
import { ComboInput, type ComboOption } from "../ui/combo-input";
import { ColorInput } from "../ui/color-input";
import { SelectInput } from "../ui/select-input";
import { SliderInput } from "../ui/slider-input";
import { TextInput } from "../ui/text-input";
import { FontInput } from "../ui/font-input";
import { SegmentedControl } from "../ui/segmented-control";
import { truncate } from "../ui/helpers";
import type { SegmentedOption } from "../ui/segmented-control";
import { IconAlignmentLeft } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconAlignmentLeft";
import { IconAlignmentCenter } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconAlignmentCenter";
import { IconAlignmentRight } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconAlignmentRight";
import { IconHorizontalAlignmentTop } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconHorizontalAlignmentTop";
import { IconHorizontalAlignmentCenter } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconHorizontalAlignmentCenter";
import { IconHorizontalAlignmentBottom } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconHorizontalAlignmentBottom";

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
  { value: "auto", label: "Auto" },
  { value: "fit-content", label: "Fit Content" },
  { value: "min-content", label: "Min Content" },
  { value: "max-content", label: "Max Content" },
  { value: "100%", label: "100%" },
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

const WORD_SPACING_OPTIONS: ComboOption[] = [
  { value: "normal", label: "Normal" },
];

const GAP_OPTIONS: ComboOption[] = [
  { value: "0px", label: "None" },
  { value: "normal", label: "Normal" },
];

export function PropertyPanel({
  element,
  position,
  onPropertyChange,
}: {
  element: InspectedElement;
  position: "left" | "right";
  onPropertyChange: (property: string, value: string) => void;
}) {
  const s = element.computedStyles;
  const isText = ["P", "H1", "H2", "H3", "H4", "H5", "H6", "SPAN", "A", "BUTTON", "LABEL", "LI", "TD", "TH", "FIGCAPTION", "BLOCKQUOTE", "CITE", "EM", "STRONG", "SMALL"].includes(element.tagName);
  const isFlex = element.layoutMode === "flex";
  const isGrid = element.layoutMode === "grid";
  const isPositioned = element.layoutMode === "absolute" || element.layoutMode === "fixed";
  const hasVerticalAlign = isText || ["IMG", "INPUT", "SELECT", "TEXTAREA"].includes(element.tagName) || isFlex || isGrid;

  return (
    <div className={`composer-panel ${position}`}>
      {/* Header */}
      <div className="composer-panel-header">
        <div className="composer-el-tag">{element.tagName.toLowerCase()}</div>
        {element.reactComponents.length > 0 && (
          <div className="composer-el-component">{element.reactComponents.join(" \u203A ")}</div>
        )}
        {element.textContent && (
          <div className="composer-el-text">&ldquo;{truncate(element.textContent, 30)}&rdquo;</div>
        )}
      </div>

      {/* Position */}
      {isPositioned && (
        <Section label="Position">
          <Row>
            <Field label="Top">
              <NumberInput label="T" prop="top" value={s.top} onChange={onPropertyChange} />
            </Field>
            <Field label="Right">
              <NumberInput label="R" prop="right" value={s.right} onChange={onPropertyChange} />
            </Field>
          </Row>
          <Row>
            <Field label="Bottom">
              <NumberInput label="B" prop="bottom" value={s.bottom} onChange={onPropertyChange} />
            </Field>
            <Field label="Left">
              <NumberInput label="L" prop="left" value={s.left} onChange={onPropertyChange} />
            </Field>
          </Row>
        </Section>
      )}

      {/* Layout */}
      <Section label="Layout">
        {isFlex && (
          <>
            <Row>
              <Field label="Direction">
                <SelectInput prop="flexDirection" value={s.flexDirection} options={["row", "row-reverse", "column", "column-reverse"]} onChange={onPropertyChange} />
              </Field>
              <Field label="Gap">
                <ComboInput prop="gap" value={s.gap} options={GAP_OPTIONS} onChange={onPropertyChange} />
              </Field>
            </Row>
            <Row>
              <Field label="Align Items">
                <SelectInput prop="alignItems" value={s.alignItems} options={["stretch", "flex-start", "center", "flex-end", "baseline"]} onChange={onPropertyChange} />
              </Field>
              <Field label="Justify">
                <SelectInput prop="justifyContent" value={s.justifyContent} options={["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"]} onChange={onPropertyChange} />
              </Field>
            </Row>
          </>
        )}
        {isGrid && (
          <>
            <Row>
              <Field label="Columns">
                <TextInput prop="gridTemplateColumns" value={s.gridTemplateColumns} onChange={onPropertyChange} />
              </Field>
            </Row>
            <Row>
              <Field label="Rows">
                <TextInput prop="gridTemplateRows" value={s.gridTemplateRows} onChange={onPropertyChange} />
              </Field>
            </Row>
            <Row>
              <Field label="Gap">
                <ComboInput prop="gap" value={s.gap} options={GAP_OPTIONS} onChange={onPropertyChange} />
              </Field>
            </Row>
          </>
        )}
        <RowGroup label="Padding">
          <div className="composer-row">
            <NumberInput label="T" prop="paddingTop" value={s.paddingTop} onChange={onPropertyChange} />
            <NumberInput label="R" prop="paddingRight" value={s.paddingRight} onChange={onPropertyChange} />
          </div>
          <div className="composer-row">
            <NumberInput label="B" prop="paddingBottom" value={s.paddingBottom} onChange={onPropertyChange} />
            <NumberInput label="L" prop="paddingLeft" value={s.paddingLeft} onChange={onPropertyChange} />
          </div>
        </RowGroup>
        <RowGroup label="Margin">
          <div className="composer-row">
            <NumberInput label="T" prop="marginTop" value={s.marginTop} onChange={onPropertyChange} />
            <NumberInput label="R" prop="marginRight" value={s.marginRight} onChange={onPropertyChange} />
          </div>
          <div className="composer-row">
            <NumberInput label="B" prop="marginBottom" value={s.marginBottom} onChange={onPropertyChange} />
            <NumberInput label="L" prop="marginLeft" value={s.marginLeft} onChange={onPropertyChange} />
          </div>
        </RowGroup>
      </Section>

      {/* Size */}
      <Section label="Size">
        <Row>
          <Field label="Width">
            <ComboInput label="W" prop="width" value={s.width} options={SIZE_OPTIONS} onChange={onPropertyChange} />
          </Field>
          <Field label="Height">
            <ComboInput label="H" prop="height" value={s.height} options={SIZE_OPTIONS} onChange={onPropertyChange} />
          </Field>
        </Row>
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
              <NumberInput prop="fontSize" value={s.fontSize} onChange={onPropertyChange} />
            </Field>
            <Field label="Weight">
              <ComboInput prop="fontWeight" value={s.fontWeight} options={FONT_WEIGHT_OPTIONS} onChange={onPropertyChange} />
            </Field>
          </Row>
          <Row>
            <Field label="Line Height">
              <ComboInput prop="lineHeight" value={s.lineHeight} options={LINE_HEIGHT_OPTIONS} onChange={onPropertyChange} />
            </Field>
            <Field label="Letter Spacing">
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
            <Field label="White Space">
              <SelectInput prop="whiteSpace" value={s.whiteSpace} options={["normal", "nowrap", "pre", "pre-wrap", "pre-line", "break-spaces"]} onChange={onPropertyChange} />
            </Field>
          </Row>
          <Row>
            <Field label="Word Spacing">
              <ComboInput prop="wordSpacing" value={s.wordSpacing} options={WORD_SPACING_OPTIONS} onChange={onPropertyChange} />
            </Field>
            <Field label="Text Indent">
              <NumberInput prop="textIndent" value={s.textIndent} onChange={onPropertyChange} />
            </Field>
          </Row>
        </Section>
      )}

      {/* Appearance */}
      <Section label="Appearance">
        <Row>
          <Field label="Opacity">
            <NumberInput prop="opacity" value={s.opacity} onChange={onPropertyChange} />
          </Field>
          <Field label="Z Index">
            <NumberInput prop="zIndex" value={s.zIndex} onChange={onPropertyChange} />
          </Field>
        </Row>
        <RowGroup label="Corner Radius">
          <div className="composer-row">
            <NumberInput label="TL" prop="borderTopLeftRadius" value={s.borderTopLeftRadius} onChange={onPropertyChange} />
            <NumberInput label="TR" prop="borderTopRightRadius" value={s.borderTopRightRadius} onChange={onPropertyChange} />
          </div>
          <div className="composer-row">
            <NumberInput label="BL" prop="borderBottomLeftRadius" value={s.borderBottomLeftRadius} onChange={onPropertyChange} />
            <NumberInput label="BR" prop="borderBottomRightRadius" value={s.borderBottomRightRadius} onChange={onPropertyChange} />
          </div>
        </RowGroup>
        <Row>
          <Field label="Overflow">
            <SelectInput prop="overflow" value={s.overflow} options={["visible", "hidden", "auto", "scroll"]} onChange={onPropertyChange} />
          </Field>
        </Row>
      </Section>

      {/* Fill */}
      <Section label="Fill">
        <Row>
          <Field label="Background">
            <ColorInput prop="backgroundColor" value={s.backgroundColor} onChange={onPropertyChange} />
          </Field>
        </Row>
      </Section>

      {/* Border */}
      <Section label="Border">
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
            <SelectInput prop="borderStyle" value={s.borderTopStyle} options={["none", "solid", "dashed", "dotted", "double", "groove", "ridge"]} onChange={onPropertyChange} />
          </Field>
        </Row>
      </Section>

      {/* Shadow */}
      {s.boxShadow && s.boxShadow !== "none" && (
        <Section label="Shadow">
          <Row>
            <Field label="Box Shadow">
              <TextInput prop="boxShadow" value={s.boxShadow} onChange={onPropertyChange} />
            </Field>
          </Row>
        </Section>
      )}

    </div>
  );
}

/**
 * PositionSection -- alignment, position type, offsets, sticky offset,
 * constraints input, and pin lines.
 *
 * Extracted from PropertyPanel.tsx lines 929-1062.
 */

import { useState, useRef, useCallback } from "react";
import type { PositionSectionProps } from "./section-props";
import type { PinState } from "../constraints-input";
import { Section, Row, Field } from "../section";
import { NumberInput } from "../number-input";
import { SelectInput } from "../select-input";
import { ConstraintsInput } from "../constraints-input";
import { Tooltip } from "../tooltip";
import {
  LayoutAlignLeft, LayoutAlignRight, LayoutAlignHorizontalCenter,
  LayoutAlignTop, LayoutAlignBottom, LayoutAlignVerticalCenter,
} from "../icons";

export function PositionSection({
  element,
  s,
  onPropertyChange,
  changeProps,
  isFlexChild,
  isGridChild,
  parentFlexDir,
  onPinLinesChange,
}: PositionSectionProps) {
  const positionType = s.position || "static";
  const isSticky = positionType === "sticky";

  // ── Pin state (detect authored position properties) ──
  const [pins, setPins] = useState<PinState>(() => {
    const el = element.element as HTMLElement;
    const cs = element.computedStyles;
    const pos = cs.position;
    if (pos !== "absolute" && pos !== "fixed") return { top: true, right: false, bottom: false, left: true };

    function isAuthored(prop: "top" | "right" | "bottom" | "left"): boolean {
      if (el.style[prop] !== "") return true;
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

  // ── Transform helper for centering ──
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

  const handlePinChange = useCallback((side: "top" | "right" | "bottom" | "left", pinned: boolean) => {
    setPins((prev) => {
      const next = { ...prev, [side]: pinned };
      onPinLinesChange?.(next);
      return next;
    });
  }, [onPinLinesChange]);

  // ── Alignment callbacks ──
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

  // ── Derived alignment state ──
  const isAbsoluteOrFixed = positionType === "absolute" || positionType === "fixed";
  const isFlexColumn = isFlexChild && parentFlexDir.startsWith("column");
  const isFlexRow = isFlexChild && !parentFlexDir.startsWith("column");

  const hEnabled = isAbsoluteOrFixed || isGridChild || isFlexColumn;
  const vEnabled = isAbsoluteOrFixed || isGridChild || isFlexRow;

  const alignSelf = s.alignSelf || "auto";
  const justifySelf = s.justifySelf || "auto";

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
    <Section label="Position">
      {/* Unified alignment row -- always visible, disabled when not applicable */}
      <Row>
        <div className="tuna-field">
          <span className="tuna-field-label">Alignment</span>
          <div className="tuna-align-row">
            <div className="tuna-btn-group" style={!hEnabled ? { opacity: 0.3, pointerEvents: "none" } : undefined}>
              <Tooltip content="Align left" side="top"><button type="button" className={`tuna-align-btn${hActive === "start" ? " active" : ""}`} onClick={() => onHClick("start")}><LayoutAlignLeft /></button></Tooltip>
              <Tooltip content="Align center horizontally" side="top"><button type="button" className={`tuna-align-btn${hActive === "center" ? " active" : ""}`} onClick={() => onHClick("center")}><LayoutAlignHorizontalCenter /></button></Tooltip>
              <Tooltip content="Align right" side="top"><button type="button" className={`tuna-align-btn${hActive === "end" ? " active" : ""}`} onClick={() => onHClick("end")}><LayoutAlignRight /></button></Tooltip>
            </div>
            <div className="tuna-btn-group" style={!vEnabled ? { opacity: 0.3, pointerEvents: "none" } : undefined}>
              <Tooltip content="Align top" side="top"><button type="button" className={`tuna-align-btn${vActive === "start" ? " active" : ""}`} onClick={() => onVClick("start")}><LayoutAlignTop /></button></Tooltip>
              <Tooltip content="Align center vertically" side="top"><button type="button" className={`tuna-align-btn${vActive === "center" ? " active" : ""}`} onClick={() => onVClick("center")}><LayoutAlignVerticalCenter /></button></Tooltip>
              <Tooltip content="Align bottom" side="top"><button type="button" className={`tuna-align-btn${vActive === "end" ? " active" : ""}`} onClick={() => onVClick("end")}><LayoutAlignBottom /></button></Tooltip>
            </div>
          </div>
        </div>
      </Row>
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
        <Row label="Offsets">
          <div className="tuna-row">
            <NumberInput label="T" prop="top" value={s.top} onChange={onPropertyChange} {...changeProps("top")} />
            <NumberInput label="R" prop="right" value={s.right} onChange={onPropertyChange} {...changeProps("right")} />
          </div>
          <div className="tuna-row">
            <NumberInput label="B" prop="bottom" value={s.bottom} onChange={onPropertyChange} {...changeProps("bottom")} />
            <NumberInput label="L" prop="left" value={s.left} onChange={onPropertyChange} {...changeProps("left")} />
          </div>
        </Row>
      )}
      {isSticky && (
        <Row label="Sticky offset">
          <div className="tuna-row">
            <NumberInput label="T" prop="top" value={s.top} onChange={onPropertyChange} {...changeProps("top")} />
            <NumberInput label="B" prop="bottom" value={s.bottom} onChange={onPropertyChange} {...changeProps("bottom")} />
          </div>
        </Row>
      )}
    </Section>
  );
}

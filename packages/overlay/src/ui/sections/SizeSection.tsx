/**
 * SizeSection — extracted from PropertyPanel.
 *
 * Two modes:
 *   • Frame mode (frameDimensions prop) — simple NumberInputs for iframe width/height
 *   • Normal mode — full ComboInput with fill/hug/auto sizing modes, aspect ratio lock,
 *     and optional min/max size extras
 */

import { useState, useRef, useEffect, useCallback } from "react";
import type { SizeSectionProps } from "./section-props";
import { Section, Row, Field } from "../section";
import { NumberInput } from "../number-input";
import { ComboInput, type ComboOption } from "../combo-input";
import { DropdownMenu } from "../dropdown-menu";
import { Tooltip } from "../tooltip";
import { Plus, Minus } from "../icons";
import { computeSizingChanges, detectSizingMode, canFill, type SizingMode } from "../sizing-utils";

type SizeExtra = "min" | "max";

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

export function SizeSection({
  element,
  s,
  onPropertyChange,
  changeProps,
  isFlexChild,
  isGridChild,
  parentFlexDir,
  frameDimensions,
}: SizeSectionProps) {
  // ── Internal state ──
  const [sizeExtras, setSizeExtras] = useState<Set<SizeExtra>>(new Set());
  const [aspectLocked, setAspectLocked] = useState(false);
  const aspectRatioRef = useRef<number>(1);
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  const [sizeMenuPos, setSizeMenuPos] = useState<{ top: number; left: number } | null>(null);

  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const sizeMenuBtnRef = useRef<HTMLButtonElement>(null);

  // Close size dropdown on outside click
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

  // ── Sizing mode detection ──
  const sizingCtx = { isFlexChild, isGridChild, parentFlexDir, currentStyles: s };
  const widthMode = detectSizingMode("width", sizingCtx);
  const heightMode = detectSizingMode("height", sizingCtx);
  const heightCanFill = canFill("height", sizingCtx);
  const heightSizeOptions = heightCanFill ? SIZE_OPTIONS : SIZE_OPTIONS.filter(o => o.value !== "__fill");
  const widthDisplayValue = widthMode === "fill" ? "__fill" : widthMode === "hug" ? "__hug" : s.width;
  const heightDisplayValue = heightMode === "fill" ? "__fill" : heightMode === "hug" ? "__hug" : s.height;

  // Auto-show size extras that have non-default values
  const visibleSizeExtras = new Set(sizeExtras);
  if ((s.minWidth && s.minWidth !== "0px" && s.minWidth !== "auto") ||
      (s.minHeight && s.minHeight !== "0px" && s.minHeight !== "auto")) visibleSizeExtras.add("min");
  if ((s.maxWidth && s.maxWidth !== "none") ||
      (s.maxHeight && s.maxHeight !== "none")) visibleSizeExtras.add("max");

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

  // ── Frame mode: simple iframe dimensions ──
  if (frameDimensions) {
    return (
      <Section label="Size">
        <Row>
          <Field label="Width">
            <NumberInput
              prop="width"
              value={`${frameDimensions.width}px`}
              onChange={(_p, v) => {
                const n = parseInt(v);
                if (!isNaN(n) && n > 0) frameDimensions.onResize(n, frameDimensions.height);
              }}
              min={200}
            />
          </Field>
          <Field label="Height">
            <NumberInput
              prop="height"
              value={`${frameDimensions.height}px`}
              onChange={(_p, v) => {
                const n = parseInt(v);
                if (!isNaN(n) && n > 0) frameDimensions.onResize(frameDimensions.width, n);
              }}
              min={200}
            />
          </Field>
        </Row>
      </Section>
    );
  }

  // ── Normal mode: full sizing controls ──
  return (
    <Section
      label="Size"
      action={
        <>
          <Tooltip content="Add constraint" side="top">
            <button
              ref={sizeMenuBtnRef}
              className="tuna-section-action"
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
          className={`tuna-split-btn${aspectLocked ? " active" : ""}`}
          onClick={() => {
            if (!aspectLocked && element.element) {
              const rect = element.element.getBoundingClientRect();
              if (rect.height > 0) aspectRatioRef.current = rect.width / rect.height;
              element.element.setAttribute("data-tuna-aspect-locked", "true");
            } else if (element.element) {
              element.element.removeAttribute("data-tuna-aspect-locked");
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
        <div className="tuna-section-row">
          <div className="tuna-row">
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
              <button className="tuna-split-btn" onClick={() => {
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
        <div className="tuna-section-row">
          <div className="tuna-row">
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
              <button className="tuna-split-btn" onClick={() => {
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
    </Section>
  );
}

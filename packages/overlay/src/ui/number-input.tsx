/**
 * NumberInput — numeric input with scrub-to-adjust on the label.
 * Equivalent to the portfolio editor's NumberInput component.
 */

import { useState, useRef, type ReactNode } from "react";
import { roundCssValue, inferCssUnit } from "./round-css-value";
import type { TokenMatch } from "../tokens/types";
import { TokenIndicator } from "./token-indicator";


function clampNum(val: number, min?: number, max?: number): number {
  if (min !== undefined && val < min) return min;
  if (max !== undefined && val > max) return max;
  return val;
}

function clampCssValue(val: string, min?: number, max?: number): string {
  if (min === undefined && max === undefined) return val;
  const num = parseFloat(val);
  if (isNaN(num)) return val;
  const clamped = clampNum(num, min, max);
  if (clamped === num) return val;
  const unit = val.match(/[a-z%]+$/i)?.[0] || "";
  return `${clamped}${unit}`;
}

export interface NumberInputProps {
  label?: ReactNode;
  prop: string;
  value: string | undefined;
  placeholder?: string;
  onChange: (prop: string, value: string) => void;
  /** Minimum numeric value (clamps scrub, arrow keys, and committed input) */
  min?: number;
  /** Maximum numeric value */
  max?: number;
  /** Step size for arrow keys and scrub (default: 1, shift multiplies by 10) */
  step?: number;
  /** Token match — shows a dot indicator when the value comes from a utility token */
  tokenMatch?: TokenMatch;
  /** CSS property name for token availability detection */
  property?: string;
  /** Callback when user picks a different token from the picker */
  onTokenSelect?: (oldToken: import("../tokens/types").UtilityToken, newToken: import("../tokens/types").UtilityToken) => void;
  /** Callback when user applies a token from scratch (no existing token) */
  onTokenApply?: (token: import("../tokens/types").UtilityToken, properties: string[]) => void;
  /** Callback when user unlinks a token */
  onTokenUnlink?: () => void;
}

export function NumberInput({ label, prop, value, placeholder, onChange, min, max, step: stepProp, tokenMatch, property, onTokenSelect, onTokenApply, onTokenUnlink }: NumberInputProps) {
  const [localValue, setLocalValue] = useState(roundCssValue(value || ""));
  const labelRef = useRef<HTMLSpanElement>(null);

  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setLocalValue(roundCssValue(value || ""));
  }

  // Scrub-to-adjust: drag on label to change numeric values
  const scrubRef = useRef({ startX: 0, startVal: 0, active: false });

  const handleLabelPointerDown = (e: React.PointerEvent) => {
    const num = parseFloat(localValue);
    if (isNaN(num)) return;
    scrubRef.current = { startX: e.clientX, startVal: num, active: true };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleLabelPointerMove = (e: React.PointerEvent) => {
    if (!scrubRef.current.active) return;
    const pixelDelta = e.clientX - scrubRef.current.startX;
    const baseStep = stepProp ?? 1;
    const raw = scrubRef.current.startVal + Math.round(pixelDelta) * baseStep;
    // Round to step precision to avoid floating point drift
    const precision = baseStep < 1 ? Math.ceil(-Math.log10(baseStep)) : 0;
    const rounded = precision > 0 ? parseFloat(raw.toFixed(precision)) : raw;
    const clamped = clampNum(rounded, min, max);
    const unit = localValue.match(/[a-z%]+$/i)?.[0] || "";
    const newVal = `${clamped}${unit}`;
    setLocalValue(newVal);
    onChange(prop, newVal);
  };

  const handleLabelPointerUp = () => {
    scrubRef.current.active = false;
  };

  // Scrub from input's left padding when there's no label
  const inputRef = useRef<HTMLInputElement>(null);
  const SCRUB_ZONE = 16; // px from left edge of input

  const handleInputPointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
    if (label) return; // label handles scrub
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left > SCRUB_ZONE) return; // click is on text, let input handle it
    const num = parseFloat(localValue);
    if (isNaN(num)) return;
    e.preventDefault(); // prevent focus/selection
    scrubRef.current = { startX: e.clientX, startVal: num, active: true };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleInputPointerMove = (e: React.PointerEvent<HTMLInputElement>) => {
    if (scrubRef.current.active) {
      const pixelDelta = e.clientX - scrubRef.current.startX;
      const baseStep = stepProp ?? 1;
      const raw = scrubRef.current.startVal + Math.round(pixelDelta) * baseStep;
      const precision = baseStep < 1 ? Math.ceil(-Math.log10(baseStep)) : 0;
      const rounded = precision > 0 ? parseFloat(raw.toFixed(precision)) : raw;
      const clamped = clampNum(rounded, min, max);
      const unit = localValue.match(/[a-z%]+$/i)?.[0] || "";
      const newVal = `${clamped}${unit}`;
      setLocalValue(newVal);
      onChange(prop, newVal);
      return;
    }
    // Update cursor based on whether pointer is in scrub zone
    const rect = e.currentTarget.getBoundingClientRect();
    const inZone = e.clientX - rect.left <= SCRUB_ZONE;
    e.currentTarget.style.cursor = inZone ? "ew-resize" : "";
  };

  const handleInputPointerUp = () => {
    scrubRef.current.active = false;
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const commitValue = (val: string) => {
    const resolved = clampCssValue(inferCssUnit(val, value || "", prop), min, max);
    setLocalValue(resolved);
    onChange(prop, resolved);
  };

  const handleBlur = () => {
    const resolved = clampCssValue(inferCssUnit(localValue, value || "", prop), min, max);
    if (resolved !== value) {
      commitValue(localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commitValue(localValue);
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const num = parseFloat(localValue);
      // If the current value is a non-numeric keyword (e.g. "normal"), ignore arrow keys
      if (isNaN(num)) return;
      const baseStep = stepProp ?? 1;
      const step = e.shiftKey ? baseStep * 10 : baseStep;
      const delta = e.key === "ArrowUp" ? step : -step;
      const raw = num + delta;
      const precision = baseStep < 1 ? Math.ceil(-Math.log10(baseStep)) : 0;
      const rounded = precision > 0 ? parseFloat(raw.toFixed(precision)) : raw;
      const clamped = clampNum(rounded, min, max);
      const unit = localValue.match(/[a-z%]+$/i)?.[0] || "";
      const newVal = `${clamped}${unit}`;
      setLocalValue(newVal);
      onChange(prop, newVal);
    }
  };

  return (
    <div className={`retune-prop${tokenMatch ? " retune-prop-has-token" : ""}`}>
      {label && (
        <span
          ref={labelRef}
          className="retune-prop-label"
          onPointerDown={handleLabelPointerDown}
          onPointerMove={handleLabelPointerMove}
          onPointerUp={handleLabelPointerUp}
        >
          {label}
        </span>
      )}
      <input
        ref={inputRef}
        className="retune-prop-input"
        style={label ? (tokenMatch ? { paddingRight: 22 } : undefined) : { paddingLeft: 8, ...(tokenMatch ? { paddingRight: 22 } : {}) }}
        value={localValue}
        placeholder={placeholder}
        onPointerDown={!label ? handleInputPointerDown : undefined}
        onPointerMove={!label ? handleInputPointerMove : undefined}
        onPointerUp={!label ? handleInputPointerUp : undefined}
        onFocus={handleFocus}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        spellCheck={false}
      />
      <TokenIndicator
        match={tokenMatch}
        property={property || prop}
        onTokenSelect={onTokenSelect}
        onTokenApply={onTokenApply}
        onTokenUnlink={onTokenUnlink}
      />
    </div>
  );
}

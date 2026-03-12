/**
 * ShorthandInput — handles comma/space-separated values for
 * multi-property fields like padding (H/V) and border-radius.
 *
 * Displays a merged value when all props match, or comma-separated
 * individual values when they differ. Supports CSS shorthand input.
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

export interface ShorthandInputProps {
  label?: ReactNode;
  props: string[];
  values: string[];
  onChange: (prop: string, value: string) => void;
  placeholder?: string;
  /** Minimum numeric value (clamps scrub, arrow keys, and committed input) */
  min?: number;
  /** Maximum numeric value */
  max?: number;
  /** Token match — shows a dot indicator when the value comes from a utility token */
  tokenMatch?: TokenMatch;
  /** CSS property name for token availability detection */
  property?: string;
  /** Callback when user picks a different token from the picker */
  onTokenSelect?: (oldToken: import("../tokens/types").UtilityToken, newToken: import("../tokens/types").UtilityToken) => void;
  /** Callback when user applies a token from scratch (no existing token) */
  onTokenApply?: (token: import("../tokens/types").UtilityToken, properties: string[]) => void;
}

function computeDisplay(values: string[]): string {
  const rounded = values.map((v) => roundCssValue(v || ""));
  if (rounded.every((v) => v === rounded[0])) return rounded[0];
  return rounded.join(", ");
}

export function ShorthandInput({ label, props, values, onChange, placeholder, min, max, tokenMatch, property, onTokenSelect, onTokenApply }: ShorthandInputProps) {
  const [localValue, setLocalValue] = useState(() => computeDisplay(values));
  const [prevValues, setPrevValues] = useState(values);

  // Sync from external changes
  if (values.join("\0") !== prevValues.join("\0")) {
    setPrevValues(values);
    setLocalValue(computeDisplay(values));
  }

  // Scrub-to-adjust: drag on label changes all values equally
  const scrubRef = useRef({ startX: 0, startVals: [] as number[], active: false });

  const handleLabelPointerDown = (e: React.PointerEvent) => {
    const nums = values.map((v) => parseFloat(v));
    if (nums.some(isNaN)) return;
    scrubRef.current = { startX: e.clientX, startVals: nums, active: true };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleLabelPointerMove = (e: React.PointerEvent) => {
    if (!scrubRef.current.active) return;
    const delta = Math.round(e.clientX - scrubRef.current.startX);
    const unit = values[0]?.match(/[a-z%]+$/i)?.[0] || "px";
    const newVals = scrubRef.current.startVals.map((v) => `${clampNum(v + delta, min, max)}${unit}`);
    setLocalValue(computeDisplay(newVals));
    props.forEach((prop, i) => onChange(prop, newVals[i]));
  };

  const handleLabelPointerUp = () => {
    scrubRef.current.active = false;
  };

  // Scrub from input's left padding when there's no label
  const SCRUB_ZONE = 16;

  const handleInputPointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
    if (label) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left > SCRUB_ZONE) return;
    const nums = values.map((v) => parseFloat(v));
    if (nums.some(isNaN)) return;
    e.preventDefault();
    scrubRef.current = { startX: e.clientX, startVals: nums, active: true };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleInputPointerMove = (e: React.PointerEvent<HTMLInputElement>) => {
    if (scrubRef.current.active) {
      const delta = Math.round(e.clientX - scrubRef.current.startX);
      const unit = values[0]?.match(/[a-z%]+$/i)?.[0] || "px";
      const newVals = scrubRef.current.startVals.map((v) => `${clampNum(v + delta, min, max)}${unit}`);
      setLocalValue(computeDisplay(newVals));
      props.forEach((prop, i) => onChange(prop, newVals[i]));
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const inZone = e.clientX - rect.left <= SCRUB_ZONE;
    e.currentTarget.style.cursor = inZone ? "ew-resize" : "";
  };

  const handleInputPointerUp = () => {
    scrubRef.current.active = false;
  };

  const commitValue = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;

    // Parse: "10" -> all same, "10, 20" or "10 20" -> individual
    const parts = trimmed.includes(",")
      ? trimmed.split(",").map((s) => s.trim()).filter(Boolean)
      : trimmed.split(/\s+/);

    if (parts.length === 1) {
      const resolved = clampCssValue(inferCssUnit(parts[0], values[0] || "", props[0]), min, max);
      props.forEach((prop) => onChange(prop, resolved));
      setLocalValue(roundCssValue(resolved));
    } else {
      // Map parts to props (cycle if fewer parts than props)
      const resolved = props.map((prop, i) =>
        clampCssValue(inferCssUnit(parts[i % parts.length], values[i] || "", prop), min, max)
      );
      props.forEach((prop, i) => onChange(prop, resolved[i]));
      setLocalValue(computeDisplay(resolved));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commitValue(localValue);
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const delta = e.key === "ArrowUp" ? step : -step;
      // Parse from localValue (up-to-date) not values prop (may be stale)
      const parts = localValue.includes(",")
        ? localValue.split(",").map((s) => s.trim())
        : props.map(() => localValue.trim());
      const newVals = props.map((_, i) => {
        const part = parts[i] || parts[0];
        const num = parseFloat(part);
        // Skip non-numeric parts (e.g. "auto") — keep them unchanged
        if (isNaN(num)) return part;
        const unit = part.match(/[a-z%]+$/i)?.[0] || "px";
        return `${clampNum(num + delta, min, max)}${unit}`;
      });
      setLocalValue(computeDisplay(newVals));
      props.forEach((prop, i) => onChange(prop, newVals[i]));
    }
  };

  const wrapperRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={wrapperRef} className={`retune-prop${tokenMatch ? " retune-prop-has-token" : ""}`}>
      {label && (
        <span
          className="retune-prop-label"
          onPointerDown={handleLabelPointerDown}
          onPointerMove={handleLabelPointerMove}
          onPointerUp={handleLabelPointerUp}
        >
          {label}
        </span>
      )}
      <input
        className="retune-prop-input"
        style={tokenMatch ? { paddingRight: 22 } : undefined}
        value={localValue}
        placeholder={placeholder}
        onPointerDown={!label ? handleInputPointerDown : undefined}
        onPointerMove={!label ? handleInputPointerMove : undefined}
        onPointerUp={!label ? handleInputPointerUp : undefined}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => { if (localValue !== computeDisplay(values)) commitValue(localValue); }}
        onKeyDown={handleKeyDown}
        spellCheck={false}
      />
      <TokenIndicator
        match={tokenMatch}
        property={property || props[0]}
        relatedProperties={props}
        onTokenSelect={onTokenSelect}
        onTokenApply={onTokenApply}
      />
    </div>
  );
}

/**
 * NumberInput — numeric input with scrub-to-adjust on the label.
 * Equivalent to the portfolio editor's NumberInput component.
 */

import { useState, useEffect, useRef } from "react";

export interface NumberInputProps {
  label?: string;
  prop: string;
  value: string | undefined;
  onChange: (prop: string, value: string) => void;
}

export function NumberInput({ label, prop, value, onChange }: NumberInputProps) {
  const [localValue, setLocalValue] = useState(value || "");
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => { setLocalValue(value || ""); }, [value]);

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
    const delta = Math.round((e.clientX - scrubRef.current.startX));
    const unit = localValue.replace(/[\d.-]+/, "") || "";
    const newVal = `${scrubRef.current.startVal + delta}${unit}`;
    setLocalValue(newVal);
    onChange(prop, newVal);
  };

  const handleLabelPointerUp = () => {
    scrubRef.current.active = false;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleBlur = () => {
    onChange(prop, localValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onChange(prop, localValue);
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const num = parseFloat(localValue);
      const base = isNaN(num) ? 0 : num;
      const step = e.shiftKey ? 10 : 1;
      const delta = e.key === "ArrowUp" ? step : -step;
      const unit = isNaN(num) ? "" : (localValue.replace(/[\d.-]+/, "") || "");
      const newVal = `${base + delta}${unit}`;
      setLocalValue(newVal);
      onChange(prop, newVal);
    }
  };

  return (
    <div className="composer-prop">
      {label && (
        <span
          ref={labelRef}
          className="composer-prop-label"
          onPointerDown={handleLabelPointerDown}
          onPointerMove={handleLabelPointerMove}
          onPointerUp={handleLabelPointerUp}
        >
          {label}
        </span>
      )}
      <input
        className="composer-prop-input"
        style={label ? undefined : { paddingLeft: 8 }}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        spellCheck={false}
      />
    </div>
  );
}

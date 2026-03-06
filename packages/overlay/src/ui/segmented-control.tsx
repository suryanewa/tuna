/**
 * SegmentedControl — icon-based toggle group for the overlay.
 * Plain CSS, no Tailwind/Radix dependencies.
 */

import { useState, type ReactNode } from "react";

export interface SegmentedOption<T extends string = string> {
  value: T;
  icon: ReactNode;
  label?: string; // tooltip / aria-label
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value?: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  disabled = false,
}: SegmentedControlProps<T>) {
  const [localValue, setLocalValue] = useState(value);
  const [prevPropValue, setPrevPropValue] = useState(value);

  // Sync from parent only when the prop itself changes (e.g. new element selected)
  if (value !== prevPropValue) {
    setPrevPropValue(value);
    setLocalValue(value);
  }

  const handleClick = (optValue: T) => {
    setLocalValue(optValue);
    onChange(optValue);
  };

  return (
    <div
      className="composer-segmented"
      style={disabled ? { opacity: 0.4, pointerEvents: "none" } : undefined}
    >
      {options.map((opt) => {
        const isSelected = localValue === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            className={`composer-segmented-item${isSelected ? " selected" : ""}${opt.disabled ? " disabled" : ""}`}
            onClick={() => handleClick(opt.value)}
            disabled={opt.disabled || disabled}
            title={opt.label}
            aria-label={opt.label}
            aria-pressed={isSelected}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}

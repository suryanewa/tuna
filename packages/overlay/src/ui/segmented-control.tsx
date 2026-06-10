/**
 * SegmentedControl — icon-based toggle group for the overlay.
 * Plain CSS, no Tailwind/Radix dependencies.
 * Features an iOS-style sliding pill indicator.
 */

import { useState, useRef, useLayoutEffect, useCallback, useEffect, type ReactNode } from "react";
import { Tooltip } from "./tooltip";

export interface SegmentedOption<T extends string = string> {
  value: T;
  icon?: ReactNode;
  label?: string; // tooltip / aria-label, also used as text content when no icon
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
  const containerRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Sync from parent only when the prop itself changes (e.g. new element selected)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const updatePill = useCallback(() => {
    const container = containerRef.current;
    const pill = pillRef.current;
    if (!container || !pill) return;

    const idx = options.findIndex((o) => o.value === localValue);
    if (idx < 0) {
      pill.style.opacity = "0";
      return;
    }

    const buttons = container.querySelectorAll<HTMLButtonElement>(".retune-segmented-item");
    const btn = buttons[idx];
    if (!btn) return;

    const containerRect = container.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const offsetX = btnRect.left - containerRect.left;

    pill.style.opacity = "1";
    pill.style.width = `${btnRect.width}px`;

    // Skip transition on first render
    if (isFirstRender.current) {
      pill.style.transition = "none";
      pill.style.transform = `translateX(${offsetX}px)`;
      // Force reflow then re-enable CSS transition
      pill.offsetHeight;
      pill.style.transition = "";
      isFirstRender.current = false;
    } else {
      pill.style.transform = `translateX(${offsetX}px)`;
    }
  }, [options, localValue]);

  useLayoutEffect(() => {
    updatePill();
  }, [updatePill]);

  const handleClick = (optValue: T) => {
    setLocalValue(optValue);
    onChange(optValue);
  };

  return (
    <div
      ref={containerRef}
      className="retune-segmented"
      style={disabled ? { opacity: 0.4, pointerEvents: "none" } : undefined}
    >
      <div ref={pillRef} className="retune-segmented-pill" />
      {options.map((opt) => {
        const isSelected = localValue === opt.value;
        const button = (
          <button
            key={opt.value}
            type="button"
            className={`retune-segmented-item${isSelected ? " selected" : ""}${opt.disabled ? " disabled" : ""}`}
            onClick={() => handleClick(opt.value)}
            disabled={opt.disabled || disabled}
            aria-label={opt.label}
            aria-pressed={isSelected}
          >
            {opt.icon || <span className="retune-segmented-text">{opt.label}</span>}
          </button>
        );
        return opt.icon && opt.label ? (
          <Tooltip key={opt.value} content={opt.label}>
            {button}
          </Tooltip>
        ) : button;
      })}
    </div>
  );
}

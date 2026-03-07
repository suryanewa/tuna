/**
 * ComboInput — number input with a dropdown for preset values.
 * Equivalent to the portfolio editor's ComboInput component.
 *
 * Supports typing numeric values (with units) and selecting
 * from a list of CSS keyword options (e.g. auto, fit-content).
 */

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { DropdownMenu, type DropdownMenuOption } from "./dropdown-menu";
import { calcMenuPosition, type MenuPosition } from "./menu-position";
import { roundCssValue, inferCssUnit } from "./round-css-value";
import { ChevronDown } from "./icons";

export interface ComboOption {
  value: string;
  label: string;
}

export interface ComboInputProps {
  label?: ReactNode;
  prop: string;
  value: string | undefined;
  options: ComboOption[];
  onChange: (prop: string, value: string) => void;
}

export function ComboInput({ label, prop, value, options, onChange }: ComboInputProps) {
  const [localValue, setLocalValue] = useState(roundCssValue(value || ""));
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setLocalValue(roundCssValue(value || ""));
  }

  const openDropdown = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const selectedIndex = Math.max(0, options.findIndex((opt) => opt.value === localValue));
    const pos = calcMenuPosition(rect, selectedIndex, options.length);
    setMenuPos(pos);
    setOpen(true);
    setHighlightedIndex(selectedIndex);
  }, [options, localValue]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setHighlightedIndex(-1);
    setMenuPos(null);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const path = e.composedPath();
      if (!path.includes(container)) {
        closeDropdown();
      }
    };
    const root = containerRef.current?.getRootNode() as ShadowRoot | Document;
    root.addEventListener("pointerdown", handlePointerDown as EventListener);
    return () => root.removeEventListener("pointerdown", handlePointerDown as EventListener);
  }, [open]);

  // Get display value: show option label if value matches an option
  const displayValue = (() => {
    const match = options.find((opt) => opt.value === localValue);
    return match ? match.label : localValue;
  })();

  // Scrub-to-adjust on label
  const scrubRef = useRef({ startX: 0, startVal: 0, active: false });

  const handleLabelPointerDown = (e: React.PointerEvent) => {
    const num = parseFloat(localValue);
    if (isNaN(num)) return;
    scrubRef.current = { startX: e.clientX, startVal: num, active: true };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleLabelPointerMove = (e: React.PointerEvent) => {
    if (!scrubRef.current.active) return;
    const delta = Math.round(e.clientX - scrubRef.current.startX);
    const unit = localValue.match(/[a-z%]+$/i)?.[0] || "";
    const newVal = `${scrubRef.current.startVal + delta}${unit}`;
    setLocalValue(newVal);
    onChange(prop, newVal);
  };

  const handleLabelPointerUp = () => {
    scrubRef.current.active = false;
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    const match = options.find(
      (opt) =>
        opt.label.toLowerCase() === newValue.toLowerCase() ||
        opt.value.toLowerCase() === newValue.toLowerCase()
    );
    if (match) {
      onChange(prop, match.value);
    }
  };

  const handleBlur = () => {
    const resolved = inferCssUnit(localValue, value || "", prop);
    setLocalValue(resolved);
    onChange(prop, resolved);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && highlightedIndex >= 0) {
        const opt = options[highlightedIndex];
        setLocalValue(opt.value);
        onChange(prop, opt.value);
        closeDropdown();
      } else {
        const resolved = inferCssUnit(localValue, value || "", prop);
        setLocalValue(resolved);
        onChange(prop, resolved);
        (e.target as HTMLInputElement).blur();
      }
      return;
    }

    if (e.key === "Escape") {
      closeDropdown();
      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (open) {
        if (e.key === "ArrowDown") {
          setHighlightedIndex((prev) => prev < options.length - 1 ? prev + 1 : prev);
        } else {
          setHighlightedIndex((prev) => prev > 0 ? prev - 1 : prev);
        }
      } else {
        const num = parseFloat(localValue);
        if (isNaN(num)) return;
        const step = e.shiftKey ? 10 : 1;
        const delta = e.key === "ArrowUp" ? step : -step;
        const unit = localValue.match(/[a-z%]+$/i)?.[0] || "";
        const newVal = `${num + delta}${unit}`;
        setLocalValue(newVal);
        onChange(prop, newVal);
      }
    }
  };

  const handleOptionSelect = (option: DropdownMenuOption) => {
    setLocalValue(option.value);
    onChange(prop, option.value);
    closeDropdown();
  };

  return (
    <div className="composer-combo" ref={containerRef}>
      {label && (
        <span
          ref={labelRef}
          className="composer-combo-label"
          onPointerDown={handleLabelPointerDown}
          onPointerMove={handleLabelPointerMove}
          onPointerUp={handleLabelPointerUp}
        >
          {label}
        </span>
      )}
      <input
        className="composer-combo-input"
        style={label ? undefined : { paddingLeft: 8 }}
        value={displayValue}
        onFocus={handleFocus}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        spellCheck={false}
      />
      <button
        type="button"
        className="composer-combo-trigger"
        onClick={() => { open ? closeDropdown() : openDropdown(); }}
        aria-label="Toggle options"
      >
        <ChevronDown />
      </button>
      {open && menuPos && (
        <div
          className="composer-combo-dropdown-anchor"
          style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
        >
          <DropdownMenu
            options={options}
            value={localValue}
            highlightedIndex={highlightedIndex}
            onSelect={handleOptionSelect}
            onHighlight={setHighlightedIndex}
            initialScrollTop={menuPos.scrollTop}
            showCheckmark
          />
        </div>
      )}
    </div>
  );
}

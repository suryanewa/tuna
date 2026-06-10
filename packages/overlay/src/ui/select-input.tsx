/**
 * SelectInput — dropdown select with a label prefix.
 * Uses the DropdownMenu for a consistent dark-themed dropdown.
 * macOS-style positioning: selected item aligns with the trigger.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { DropdownMenu, type DropdownMenuOption } from "./dropdown-menu";
import { calcMenuPosition, type MenuPosition } from "./menu-position";
import { ChevronDown } from "./icons";
import { ChangeIndicator } from "./change-indicator";
import { useScrollLock } from "./use-scroll-lock";
import { isMixedValue, MIXED_LABEL } from "./mixed-value";

export interface SelectInputProps {
  label?: string;
  prop: string;
  value: string | undefined;
  options: string[];
  onChange: (prop: string, value: string) => void;
  isChanged?: boolean;
  onReset?: () => void;
}

function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

export function SelectInput({ label, prop, value, options, onChange, isChanged, onReset }: SelectInputProps) {
  const [localValue, setLocalValue] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useScrollLock(open);

  // Sync from parent without setState during render (React 19)
  useEffect(() => {
    setLocalValue(isMixedValue(value) ? MIXED_LABEL : value || "");
  }, [value]);

  const openDropdown = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const selectedIndex = Math.max(0, options.indexOf(localValue));
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
  }, [open, closeDropdown]);

  const menuOptions: DropdownMenuOption[] = options.map((opt) => ({
    value: opt,
    label: sentenceCase(opt),
  }));

  const handleSelect = (option: DropdownMenuOption) => {
    setLocalValue(option.value);
    onChange(prop, option.value);
    closeDropdown();
  };

  const displayValue = isMixedValue(localValue) ? MIXED_LABEL : sentenceCase(localValue);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open && highlightedIndex >= 0) {
        handleSelect(menuOptions[highlightedIndex]);
      } else {
        open ? closeDropdown() : openDropdown();
      }
    } else if (e.key === "Escape") {
      closeDropdown();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (open) {
        setHighlightedIndex((prev) => prev < options.length - 1 ? prev + 1 : prev);
      } else {
        openDropdown();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (open) {
        setHighlightedIndex((prev) => prev > 0 ? prev - 1 : prev);
      }
    }
  };

  return (
    <div className="retune-select" ref={containerRef}>
      <ChangeIndicator isChanged={isChanged ?? false} onReset={onReset ?? (() => {})} />
      <button
        type="button"
        className="retune-select-button"
        onClick={() => { open ? closeDropdown() : openDropdown(); }}
        onKeyDown={handleKeyDown}
      >
        {label && <span className="retune-select-label">{label}</span>}
        <span className="retune-select-value" style={label ? undefined : { paddingLeft: 8 }}>{displayValue}</span>
        <span className="retune-select-chevron">
          <ChevronDown />
        </span>
      </button>
      {open && menuPos && (
        <div
          className="retune-select-dropdown-anchor"
          style={{ top: menuPos.top, right: window.innerWidth - menuPos.left - menuPos.width, minWidth: menuPos.width }}
        >
          <DropdownMenu
            options={menuOptions}
            value={localValue}
            highlightedIndex={highlightedIndex}
            onSelect={handleSelect}
            onHighlight={setHighlightedIndex}
            initialScrollTop={menuPos.scrollTop}
            showCheckmark
          />
        </div>
      )}
    </div>
  );
}

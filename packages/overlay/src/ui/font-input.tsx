/**
 * FontInput — font family picker with dropdown of common fonts.
 * Extracts the primary font name from CSS font stacks and shows
 * a searchable dropdown with font previews.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { DropdownMenu, type DropdownMenuOption } from "./dropdown-menu";
import { calcMenuPosition, type MenuPosition } from "./menu-position";
import { IconChevronDownSmall } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconChevronDownSmall";

const COMMON_FONTS = [
  "Inter",
  "Arial",
  "Helvetica",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Trebuchet MS",
  "Palatino",
  "Garamond",
  "system-ui",
  "sans-serif",
  "serif",
  "monospace",
];

/** Extract the primary font name from a CSS font-family stack */
function extractPrimaryFont(fontFamily: string): string {
  if (!fontFamily) return "";
  // Split on comma, take the first, strip quotes and whitespace
  const first = fontFamily.split(",")[0].trim();
  return first.replace(/^["']|["']$/g, "");
}

export interface FontInputProps {
  prop: string;
  value: string | undefined;
  onChange: (prop: string, value: string) => void;
}

export function FontInput({ prop, value, onChange }: FontInputProps) {
  const primaryFont = extractPrimaryFont(value || "");
  const [localValue, setLocalValue] = useState(primaryFont);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const [filter, setFilter] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from parent
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setLocalValue(extractPrimaryFont(value || ""));
  }

  const filteredFonts = filter
    ? COMMON_FONTS.filter((f) => f.toLowerCase().includes(filter.toLowerCase()))
    : COMMON_FONTS;

  const menuOptions: DropdownMenuOption[] = filteredFonts.map((f) => ({
    value: f,
    label: f,
  }));

  const openDropdown = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const selectedIndex = Math.max(0, filteredFonts.indexOf(localValue));
    const pos = calcMenuPosition(rect, selectedIndex, filteredFonts.length);
    setMenuPos(pos);
    setOpen(true);
    setHighlightedIndex(selectedIndex);
    setFilter("");
  }, [filteredFonts, localValue]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setHighlightedIndex(-1);
    setMenuPos(null);
    setFilter("");
  }, []);

  // Close on outside click
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

  const handleSelect = (option: DropdownMenuOption) => {
    setLocalValue(option.value);
    onChange(prop, option.value);
    closeDropdown();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    if (open) {
      setFilter(val);
      setHighlightedIndex(0);
    }
  };

  const handleFocus = () => {
    if (!open) openDropdown();
  };

  const handleBlur = () => {
    if (localValue && localValue !== primaryFont) {
      onChange(prop, localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && highlightedIndex >= 0 && highlightedIndex < menuOptions.length) {
        handleSelect(menuOptions[highlightedIndex]);
      } else {
        onChange(prop, localValue);
        closeDropdown();
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
      if (!open) {
        openDropdown();
        return;
      }
      if (e.key === "ArrowDown") {
        setHighlightedIndex((prev) => prev < menuOptions.length - 1 ? prev + 1 : prev);
      } else {
        setHighlightedIndex((prev) => prev > 0 ? prev - 1 : prev);
      }
    }
  };

  return (
    <div className="composer-font-input" ref={containerRef}>
      <input
        ref={inputRef}
        className="composer-font-input-field"
        value={localValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        spellCheck={false}
      />
      <button
        type="button"
        className="composer-combo-trigger"
        onClick={() => { open ? closeDropdown() : openDropdown(); }}
        aria-label="Toggle fonts"
      >
        <IconChevronDownSmall size={20} />
      </button>
      {open && menuPos && (
        <div
          className="composer-combo-dropdown-anchor"
          style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
        >
          <DropdownMenu
            options={menuOptions}
            value={localValue}
            highlightedIndex={highlightedIndex}
            onSelect={handleSelect}
            onHighlight={setHighlightedIndex}
            initialScrollTop={menuPos.scrollTop}
            showCheckmark
            renderLabel={(option) => (
              <span style={{ fontFamily: option.value }}>{option.label}</span>
            )}
          />
        </div>
      )}
    </div>
  );
}

/**
 * FontInput — font family picker with dropdown of common fonts.
 * Extracts the primary font name from CSS font stacks and shows
 * a searchable dropdown with font previews.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { DropdownMenu, type DropdownMenuOption } from "./dropdown-menu";
import { calcMenuPosition, type MenuPosition } from "./menu-position";
import { ChevronDown } from "./icons";
import { useScrollLock } from "./use-scroll-lock";

const FALLBACK_FONTS = [
  "system-ui",
  "sans-serif",
  "serif",
  "monospace",
];

/** Scan stylesheets to find font families used in the project */
function detectProjectFonts(): string[] {
  const fonts = new Set<string>();
  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (!(rule instanceof CSSStyleRule)) continue;
          const ff = rule.style.getPropertyValue("font-family");
          if (!ff) continue;
          // Extract individual font names from the stack
          for (const part of ff.split(",")) {
            const name = part.trim().replace(/^["']|["']$/g, "");
            if (name && !FALLBACK_FONTS.includes(name)) {
              fonts.add(name);
            }
          }
        }
      } catch { /* cross-origin sheet */ }
    }
  } catch { /* stylesheet access not supported */ }
  return Array.from(fonts).sort();
}

let projectFontsCache: string[] | null = null;
function getProjectFonts(): string[] {
  if (!projectFontsCache) {
    projectFontsCache = detectProjectFonts();
    // Refresh after 10s (same as token cache)
    setTimeout(() => { projectFontsCache = null; }, 10000);
  }
  return projectFontsCache;
}

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
  useScrollLock(open);

  // Sync from parent
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setLocalValue(extractPrimaryFont(value || ""));
  }

  // Build font list: project fonts first, then fallbacks
  const allFonts = useMemo(() => {
    const project = getProjectFonts();
    // Deduplicate: project fonts + fallbacks, preserving order
    const seen = new Set(project.map(f => f.toLowerCase()));
    const fallbacks = FALLBACK_FONTS.filter(f => !seen.has(f.toLowerCase()));
    return [...project, ...fallbacks];
  }, []);

  const filteredFonts = filter
    ? allFonts.filter((f) => f.toLowerCase().includes(filter.toLowerCase()))
    : allFonts;

  const projectFontCount = getProjectFonts().length;
  const menuOptions: DropdownMenuOption[] = filteredFonts.map((f, i) => {
    // Add heading before fallback section (only when not filtering)
    const isFirstFallback = !filter && i === projectFontCount && projectFontCount > 0;
    return {
      value: f,
      label: f,
      ...(isFirstFallback ? { separatorBefore: true, headingBefore: "Generic" } : {}),
      ...(!filter && i === 0 && projectFontCount > 0 ? { headingBefore: "Project fonts" } : {}),
    };
  });

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

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
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
    <div className="retune-font-input" ref={containerRef}>
      <input
        ref={inputRef}
        className="retune-font-input-field"
        value={localValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        spellCheck={false}
      />
      <button
        type="button"
        className="retune-combo-trigger"
        onClick={() => { open ? closeDropdown() : openDropdown(); }}
        aria-label="Toggle fonts"
      >
        <ChevronDown />
      </button>
      {open && menuPos && (
        <div
          className="retune-combo-dropdown-anchor"
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

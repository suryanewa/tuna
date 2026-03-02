"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check16 } from "@/components/icons/editor-16";
import { ChevronDown } from "@/components/icons/editor";
import { Dropdown } from "../ui/dropdown";
import { loadGoogleFontsBatch } from "./font-loader";
import type { GoogleFontEntry, FontCategory } from "./font-data";

// ─── Category fallback map ─────────────────────────────────────────────
const CATEGORY_FALLBACK: Record<string, string> = {
  "sans-serif": "sans-serif",
  serif: "serif",
  display: "cursive",
  handwriting: "cursive",
  monospace: "monospace",
};

// ─── FontPickerTrigger ─────────────────────────────────────────────────

export const FontPickerTrigger = React.forwardRef<
  HTMLButtonElement,
  { value: string; disabled?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ value, disabled, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    disabled={disabled}
    className={cn(
      "relative flex items-center w-full min-w-[96px] h-6 rounded",
      "bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100",
      "text-[11px] font-[450] tracking-[0.055px]",
      "hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors duration-150",
      "focus-visible:outline-none",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      className
    )}
    {...props}
  >
    <span className="flex-1 text-left truncate pl-1.5 pr-6">
      {value || "Select font..."}
    </span>
    <ChevronDown className="absolute right-0 w-6 h-6 text-stone-900 dark:text-stone-100" />
  </button>
));
FontPickerTrigger.displayName = "FontPickerTrigger";

// ─── Virtualization hook ────────────────────────────────────────────────

const ROW_HEIGHT = 28;
const OVERSCAN = 12;
const TARGET_FONT_SIZE = 16;
const GENERATION_FONT_SIZE = 32;

function useVirtualizer(
  filteredFonts: GoogleFontEntry[],
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  const [scrollTop, setScrollTop] = React.useState(0);
  const [containerHeight, setContainerHeight] = React.useState(0);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    },
    []
  );

  const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT);
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN
  );
  const endIndex = Math.min(
    filteredFonts.length,
    startIndex + visibleCount + OVERSCAN * 2
  );
  const visibleFonts = filteredFonts.slice(startIndex, endIndex);
  const totalHeight = filteredFonts.length * ROW_HEIGHT;
  const offsetY = startIndex * ROW_HEIGHT;

  return { visibleFonts, totalHeight, offsetY, startIndex, handleScroll };
}

// ─── FontPicker props ───────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "sans-serif", label: "Sans Serif" },
  { value: "serif", label: "Serif" },
  { value: "display", label: "Display" },
  { value: "handwriting", label: "Handwriting" },
  { value: "monospace", label: "Monospace" },
];

interface FontPickerProps {
  fonts: GoogleFontEntry[];
  selectedFont: string;
  onSelect: (fontFamily: string) => void;
  onHover?: (fontFamily: string | null) => void;
  searchQuery: string;
  category: FontCategory;
  onCategoryChange: (cat: FontCategory) => void;
  previews?: Record<string, { d: string; vb: string; hr: number }>;
}

// ─── FontPicker ─────────────────────────────────────────────────────────

export function FontPicker({
  fonts,
  selectedFont,
  onSelect,
  onHover,
  searchQuery,
  category,
  onCategoryChange,
  previews,
}: FontPickerProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);

  // Filter fonts
  const filteredFonts = React.useMemo(() => {
    let result = fonts;
    if (category !== "all") {
      result = result.filter((f) => f.category === category);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((f) => f.family.toLowerCase().includes(q));
    }
    return result.slice().sort((a, b) => a.family.localeCompare(b.family));
  }, [fonts, category, searchQuery]);

  // Reset highlight when filters change (adjust state during render)
  const [prevSearchQuery, setPrevSearchQuery] = React.useState(searchQuery);
  const [prevCategory, setPrevCategory] = React.useState(category);
  if (searchQuery !== prevSearchQuery || category !== prevCategory) {
    setPrevSearchQuery(searchQuery);
    setPrevCategory(category);
    setHighlightedIndex(-1);
  }

  // Scroll to selected font on mount
  const hasScrolledRef = React.useRef(false);
  React.useEffect(() => {
    if (hasScrolledRef.current || !scrollRef.current || !selectedFont) return;
    const idx = filteredFonts.findIndex((f) => f.family === selectedFont);
    if (idx >= 0) {
      const container = scrollRef.current;
      const targetTop = idx * ROW_HEIGHT;
      // Center the selected font in the container
      container.scrollTop = Math.max(0, targetTop - container.clientHeight / 2 + ROW_HEIGHT / 2);
      hasScrolledRef.current = true;
    }
  }, [filteredFonts, selectedFont]);

  // Virtualization
  const { visibleFonts, totalHeight, offsetY, startIndex, handleScroll } =
    useVirtualizer(filteredFonts, scrollRef);

  // Batch-load visible fonts that don't have SVG previews (debounced).
  const visibleFamiliesKey = visibleFonts.map((f) => f.family).join("\t");

  React.useEffect(() => {
    if (!visibleFamiliesKey) return;
    const fontsToLoad = visibleFamiliesKey
      .split("\t")
      .filter((f) => !previews?.[f]);
    if (fontsToLoad.length === 0) return;
    const timer = setTimeout(() => {
      loadGoogleFontsBatch(fontsToLoad);
    }, 30);
    return () => clearTimeout(timer);
  }, [visibleFamiliesKey, previews]);

  // Keyboard navigation
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          Math.min(prev + 1, filteredFonts.length - 1)
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && highlightedIndex >= 0) {
        e.preventDefault();
        const font = filteredFonts[highlightedIndex];
        if (font) onSelect(font.family);
      }
    },
    [filteredFonts, highlightedIndex, onSelect]
  );

  // Scroll highlighted row into view
  React.useEffect(() => {
    if (highlightedIndex < 0 || !scrollRef.current) return;
    const targetTop = highlightedIndex * ROW_HEIGHT;
    const container = scrollRef.current;
    const { scrollTop, clientHeight } = container;

    if (targetTop < scrollTop) {
      container.scrollTop = targetTop;
    } else if (targetTop + ROW_HEIGHT > scrollTop + clientHeight) {
      container.scrollTop = targetTop + ROW_HEIGHT - clientHeight;
    }
  }, [highlightedIndex]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Category filter */}
      <div className="px-2 pt-1 pb-2">
        <Dropdown
          value={category}
          onValueChange={(v) => onCategoryChange(v as FontCategory)}
          options={CATEGORY_OPTIONS}
          menuWidth="trigger"
        />
      </div>

      {/* Font list */}
      {filteredFonts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[11px] text-stone-400 dark:text-stone-500">
            No matching fonts
          </span>
        </div>
      ) : (
        <div
          ref={scrollRef}
          role="listbox"
          tabIndex={0}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onMouseLeave={() => onHover?.(null)}
          className="flex-1 overflow-y-auto overscroll-none min-h-0 focus:outline-none"
        >
          <div style={{ height: totalHeight, position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: offsetY,
                left: 0,
                right: 0,
              }}
            >
              {visibleFonts.map((font, i) => {
                const globalIndex = startIndex + i;
                const isSelected = font.family === selectedFont;
                const isHighlighted = globalIndex === highlightedIndex;
                const preview = previews?.[font.family];

                return (
                  <div
                    key={font.family}
                    className={cn(
                      "cursor-pointer",
                      isSelected && "bg-blue-100 dark:bg-blue-900/30",
                      isHighlighted &&
                        !isSelected &&
                        "bg-stone-100 dark:bg-stone-800",
                      !isSelected &&
                        !isHighlighted &&
                        "hover:bg-stone-100 dark:hover:bg-stone-800/50"
                    )}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => onSelect(font.family)}
                    onMouseEnter={() => {
                      setHighlightedIndex(globalIndex);
                      onHover?.(font.family);
                    }}
                    onMouseLeave={() => onHover?.(null)}
                  >
                    <div className="h-8 mx-2 px-1 py-1.5 flex items-center gap-1">
                      <span className="w-4 flex-shrink-0 flex items-center justify-center">
                        {isSelected && (
                          <Check16
                            className="text-stone-900 dark:text-stone-100"
                          />
                        )}
                      </span>
                      {preview ? (
                        <span className="flex-1 min-w-0">
                          <svg
                            viewBox={preview.vb}
                            fill="currentColor"
                            className="text-stone-900 dark:text-stone-100"
                            style={{
                              height: Math.min(
                                parseFloat(preview.vb.split(/\s+/)[3]) * (TARGET_FONT_SIZE / GENERATION_FONT_SIZE),
                                26
                              ),
                            }}
                            overflow="visible"
                            role="img"
                            aria-label={font.family}
                            preserveAspectRatio="xMinYMid meet"
                          >
                            <path d={preview.d} />
                          </svg>
                        </span>
                      ) : (
                        <span
                          className="text-base font-[450] text-stone-900 dark:text-stone-100 truncate"
                          data-font-preview
                          style={{
                            fontFamily: `'${font.family}', ${CATEGORY_FALLBACK[font.category] || "sans-serif"}`,
                          }}
                        >
                          {font.family}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

FontPicker.displayName = "FontPicker";

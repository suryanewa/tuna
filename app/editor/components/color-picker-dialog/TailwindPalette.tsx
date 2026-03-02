"use client";

import * as React from "react";
import {
  getFlatTailwindPalette,
  type TailwindPaletteItem,
  buildColorClass,
} from "./color-utils";

// ─── Types ──────────────────────────────────────────────────────────────

interface TailwindPaletteProps {
  searchQuery: string;
  prefix: string; // "bg" | "text" | "border" | "shadow"
  onSelect: (colorClass: string, hex: string) => void;
  selectedValue?: string; // current selected Tailwind class for highlighting
}

// ─── Virtualization ─────────────────────────────────────────────────────

const HEADER_HEIGHT = 32;
const COLOR_ROW_HEIGHT = 32;
const OVERSCAN = 12;

function getRowHeight(item: TailwindPaletteItem): number {
  return item.type === "header" ? HEADER_HEIGHT : COLOR_ROW_HEIGHT;
}

function useVirtualizer(
  items: TailwindPaletteItem[],
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

  // Precompute cumulative offsets
  const offsets = React.useMemo(() => {
    const arr = new Array<number>(items.length + 1);
    arr[0] = 0;
    for (let i = 0; i < items.length; i++) {
      arr[i + 1] = arr[i] + getRowHeight(items[i]);
    }
    return arr;
  }, [items]);

  const totalHeight = offsets[items.length] ?? 0;

  // Binary search for start index
  let lo = 0;
  let hi = items.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (offsets[mid + 1] <= scrollTop) lo = mid + 1;
    else hi = mid;
  }
  const startIndex = Math.max(0, lo - OVERSCAN);

  // Find end index
  let endIndex = startIndex;
  const bottomEdge = scrollTop + containerHeight;
  while (endIndex < items.length && offsets[endIndex] < bottomEdge) {
    endIndex++;
  }
  endIndex = Math.min(items.length, endIndex + OVERSCAN);

  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = offsets[startIndex];

  return { visibleItems, totalHeight, offsetY, startIndex, offsets, handleScroll };
}

// ─── Filtering ──────────────────────────────────────────────────────────

function filterPaletteItems(
  items: TailwindPaletteItem[],
  query: string
): TailwindPaletteItem[] {
  if (!query) return items;

  const q = query.toLowerCase();

  // First pass: determine which families have at least one matching color
  const matchingFamilies = new Set<string>();
  for (const item of items) {
    if (item.type === "color") {
      if (
        item.family.toLowerCase().includes(q) ||
        item.shade.toLowerCase().includes(q)
      ) {
        matchingFamilies.add(item.family);
      }
    } else if (item.type === "header") {
      if (item.family.toLowerCase().includes(q)) {
        matchingFamilies.add(item.family);
      }
    }
  }

  // Second pass: include headers for matching families and matching colors
  const result: TailwindPaletteItem[] = [];
  for (const item of items) {
    if (item.type === "header") {
      if (matchingFamilies.has(item.family)) {
        result.push(item);
      }
    } else if (item.type === "color") {
      // If the family header matched the query, include all colors in that family
      if (item.family.toLowerCase().includes(q)) {
        result.push(item);
      } else if (item.shade.toLowerCase().includes(q)) {
        result.push(item);
      }
    }
  }

  return result;
}

// ─── TailwindPalette ────────────────────────────────────────────────────

export const TailwindPalette = React.memo(function TailwindPalette({
  searchQuery,
  prefix,
  onSelect,
  selectedValue,
}: TailwindPaletteProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const allItems = getFlatTailwindPalette();

  const filteredItems = React.useMemo(
    () => filterPaletteItems(allItems, searchQuery),
    [allItems, searchQuery]
  );

  const { visibleItems, totalHeight, offsetY, startIndex, offsets, handleScroll } =
    useVirtualizer(filteredItems, scrollRef);

  if (filteredItems.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-[11px] text-stone-400 dark:text-stone-500">
          No matching colors
        </span>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto overscroll-none min-h-0"
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
          {visibleItems.map((item, i) => {
            const globalIndex = startIndex + i;
            const rowHeight = getRowHeight(item);

            if (item.type === "header") {
              return (
                <div
                  key={`header-${item.family}-${globalIndex}`}
                  style={{ height: rowHeight }}
                  className="flex items-center px-4 py-1 text-[11px] font-[550] tracking-[0.055px] text-stone-500 dark:text-stone-400 capitalize"
                >
                  {item.family}
                </div>
              );
            }

            const colorClass = buildColorClass(
              prefix,
              item.family,
              item.shade,
              100,
              false,
              ""
            );
            const isSelected = selectedValue === colorClass;

            return (
              <button
                key={`color-${item.family}-${item.shade}-${globalIndex}`}
                style={{ height: rowHeight }}
                onClick={() => onSelect(colorClass, item.hex)}
                className={`flex items-center gap-2 px-4 py-1 w-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors ${
                  isSelected ? "bg-blue-50 dark:bg-blue-950" : ""
                }`}
              >
                <div
                  className="w-3.5 h-3.5 rounded-[2px] flex-shrink-0"
                  style={{
                    backgroundColor: item.hex,
                    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
                  }}
                />
                <span className="text-[11px] font-[450] tracking-[0.055px] text-stone-900 dark:text-stone-100">
                  {item.family}-{item.shade}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

TailwindPalette.displayName = "TailwindPalette";

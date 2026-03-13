/**
 * TokenDialog — floating panel for browsing and selecting tokens.
 * Shows all available semantic tokens for a CSS property with search
 * and category grouping.
 *
 * Uses FloatingDialog as the shell (positioning, header, search, close handling).
 * Token list items use native DOM event listeners because React's event
 * delegation doesn't work inside Shadow DOM portals (see token-indicator.tsx).
 */

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import type { UtilityToken } from "../tokens/types";
import { getTokensForProperty } from "../tokens/resolver";
import { getCategoryForProperty } from "../tokens/categories";
import { FloatingDialog } from "./floating-dialog";

export interface TokenDialogProps {
  property: string;
  currentToken?: UtilityToken;
  onSelect: (token: UtilityToken) => void;
  onClose: () => void;
  anchorRect: { top: number; left: number; width: number; height: number };
}

/** Format a token value for display (first property value, simplified) */
function formatValue(token: UtilityToken): string {
  const vals = Object.values(token.values);
  if (vals.length === 0) return "";
  const val = vals[0];
  return val.length > 20 ? val.slice(0, 20) + "\u2026" : val;
}

/** Get a swatch color if this is a color token */
function getSwatchColor(token: UtilityToken): string | null {
  for (const [prop, val] of Object.entries(token.values)) {
    if (prop.includes("color") || prop === "background-color" || prop === "fill" || prop === "stroke") {
      return val;
    }
  }
  return null;
}

export function TokenDialog({ property, currentToken, onSelect, onClose, anchorRect }: TokenDialogProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const allTokens = useMemo(() => getTokensForProperty(property), [property]);
  const category = getCategoryForProperty(property.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`));
  const isColor = category === "colors";

  const filtered = useMemo(() => {
    if (!search) return allTokens;
    const q = search.toLowerCase();
    return allTokens.filter(t =>
      t.className.toLowerCase().includes(q) ||
      Object.values(t.values).some(v => v.toLowerCase().includes(q))
    );
  }, [allTokens, search]);

  // Reset highlight when the filtered list changes (e.g. new search query)
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filtered]);

  // Auto-scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0) return;
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector(`[data-token-index="${highlightedIndex}"]`);
    if (item) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  // Store refs for native handlers
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;

  // Keyboard navigation handler for the search input
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = filteredRef.current.length;
    if (count === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % count);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(prev => (prev <= 0 ? count - 1 : prev - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      setHighlightedIndex(curr => {
        if (curr >= 0 && curr < count) {
          const token = filteredRef.current[curr];
          if (token) {
            onSelectRef.current(token);
            onCloseRef.current();
          }
        }
        return curr;
      });
    }
  }, []);

  // Native click handler for token items (React delegation doesn't work in Shadow DOM)
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const handleClick = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      const item = target.closest<HTMLElement>("[data-token-index]");
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(item.dataset.tokenIndex!, 10);
      const token = filteredRef.current[idx];
      if (token) {
        onSelectRef.current(token);
        onCloseRef.current();
      }
    };
    list.addEventListener("pointerdown", handleClick);
    return () => list.removeEventListener("pointerdown", handleClick);
  }, []);

  const categoryLabel = category
    ? category.charAt(0).toUpperCase() + category.slice(1)
    : "Tokens";

  return (
    <FloatingDialog
      title={categoryLabel}
      onClose={onClose}
      anchorRect={anchorRect}
      search={{ value: search, onChange: setSearch, placeholder: "Search", onKeyDown: handleSearchKeyDown }}
      minHeight={300}
    >
      <div ref={listRef} className="retune-token-dialog-list">
        {filtered.length === 0 && (
          <div className="retune-token-dialog-empty">No tokens found</div>
        )}
        {filtered.map((token, i) => {
          const isActive = currentToken?.className === token.className;
          const isHighlighted = i === highlightedIndex;
          return (
            <div
              key={token.className}
              className={`retune-token-dialog-item${isActive ? " retune-token-dialog-item-active" : ""}${isHighlighted ? " retune-token-dialog-item-highlighted" : ""}`}
              data-token-index={i}
            >
              {isActive && <span className="retune-token-dialog-active-dot" />}
              {isColor && (
                <span
                  className="retune-token-dialog-swatch"
                  style={{ backgroundColor: getSwatchColor(token) || "transparent" }}
                />
              )}
              <span className="retune-token-dialog-name">{token.className}</span>
              <span className="retune-token-dialog-value">{formatValue(token)}</span>
            </div>
          );
        })}
      </div>
    </FloatingDialog>
  );
}

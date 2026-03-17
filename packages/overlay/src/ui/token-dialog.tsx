/**
 * TokenDialog — floating panel for browsing and selecting variables.
 * Shows all available CSS custom properties for a CSS property with search
 * and category grouping.
 *
 * Uses FloatingDialog as the shell (positioning, header, search, close handling).
 * List items use native DOM event listeners because React's event
 * delegation doesn't work inside Shadow DOM portals (see variable-action.tsx).
 */

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import type { UtilityToken } from "../tokens/types";
import { getVariablesForProperty } from "../tokens/resolver";
import { getCategoryForProperty } from "../tokens/categories";
import { FloatingDialog } from "./floating-dialog";
import { Tooltip } from "./tooltip";

export interface TokenDialogProps {
  property: string;
  currentToken?: UtilityToken;
  onSelect: (token: UtilityToken) => void;
  onUnlink?: () => void;
  onClose: () => void;
  anchorRect: { top: number; left: number; width: number; height: number };
}

/** Format a variable name for display: strip var(-- ) wrapper → "spacing-4" */
function formatName(className: string): string {
  if (className.startsWith("var(--") && className.endsWith(")")) {
    return className.slice(6, -1);
  }
  return className;
}

/** Format a variable value for display (first property value, simplified) */
function formatValue(token: UtilityToken): string {
  const vals = Object.values(token.values);
  if (vals.length === 0) return "";
  const val = vals[0];
  return val.length > 20 ? val.slice(0, 20) + "\u2026" : val;
}

/** Get a swatch color if this is a color variable */
function getSwatchColor(token: UtilityToken): string | null {
  for (const [prop, val] of Object.entries(token.values)) {
    if (prop.includes("color") || prop === "background-color" || prop === "fill" || prop === "stroke") {
      return val;
    }
  }
  return null;
}

export function TokenDialog({ property, currentToken, onSelect, onUnlink, onClose, anchorRect }: TokenDialogProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const allTokens = useMemo(() => getVariablesForProperty(property), [property]);
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

  // Native click handler for list items (React delegation doesn't work in Shadow DOM)
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

  const handleHeaderAction = useCallback((action: string) => {
    if (action === "unlink") {
      onUnlink?.();
    }
  }, [onUnlink]);

  const isUnlinkDisabled = !currentToken;

  const unlinkButton = (
    <Tooltip content={currentToken ? "Unlink variable" : "No variable linked"} side="bottom" delay={300}>
      <button
        type="button"
        className="retune-floating-dialog-close"
        data-dialog-action={isUnlinkDisabled ? undefined : "unlink"}
        style={isUnlinkDisabled ? { opacity: 0.3, cursor: "default" } : undefined}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M8.14694 12.1475C8.3422 11.9522 8.65871 11.9522 8.85397 12.1475C9.04903 12.3427 9.04916 12.6593 8.85397 12.8545L7.35397 14.3545C6.72133 14.9876 6.72123 16.0134 7.35397 16.6465C7.98708 17.2796 9.01376 17.2795 9.64694 16.6465L11.1469 15.1465C11.3421 14.9517 11.6588 14.9517 11.854 15.1465C12.0491 15.3416 12.0488 15.6582 11.854 15.8535L10.354 17.3535C9.33027 18.377 7.67057 18.3771 6.64694 17.3535C5.62359 16.3299 5.6235 14.6701 6.64694 13.6465L8.14694 12.1475ZM14.5005 15.5C14.7764 15.5001 15.0004 15.724 15.0005 16V17.5C15.0005 17.7761 14.7765 17.9999 14.5005 18C14.2243 18 14.0005 17.7761 14.0005 17.5V16C14.0005 15.7239 14.2244 15.5 14.5005 15.5ZM17.5005 14C17.7764 14.0001 18.0004 14.224 18.0005 14.5C18.0005 14.7761 17.7765 14.9999 17.5005 15H16.0005C15.7243 15 15.5005 14.7761 15.5005 14.5C15.5005 14.2239 15.7244 14 16.0005 14H17.5005ZM13.6469 6.64648C14.6706 5.62308 16.3303 5.62301 17.354 6.64648C18.3774 7.6701 18.3774 9.32986 17.354 10.3535L15.854 11.8535C15.6587 12.0487 15.3422 12.0487 15.1469 11.8535C14.9517 11.6583 14.9518 11.3417 15.1469 11.1465L16.6469 9.64648C17.2798 9.01335 17.2799 7.98661 16.6469 7.35351C16.0138 6.72057 14.9871 6.72064 14.354 7.35351L12.854 8.85351C12.6588 9.04859 12.3422 9.04843 12.1469 8.85351C11.952 8.65825 11.9519 8.34165 12.1469 8.14648L13.6469 6.64648ZM8.00045 9C8.27642 9.00014 8.50036 9.22402 8.50045 9.5C8.50045 9.77605 8.27647 9.99985 8.00045 10H6.50045C6.22431 10 6.00045 9.77614 6.00045 9.5C6.00054 9.22393 6.22437 9 6.50045 9H8.00045ZM9.50045 6C9.77642 6.00014 10.0004 6.22402 10.0005 6.5V8C10.0005 8.27605 9.77647 8.49985 9.50045 8.5C9.22431 8.5 9.00045 8.27614 9.00045 8V6.5C9.00054 6.22393 9.22437 6 9.50045 6Z" fill="rgba(0,0,0,0.9)" />
        </svg>
      </button>
    </Tooltip>
  );

  return (
    <FloatingDialog
      title="Variables"
      onClose={onClose}
      anchorRect={anchorRect}
      search={{ value: search, onChange: setSearch, placeholder: "Search", onKeyDown: handleSearchKeyDown }}
      headerActions={unlinkButton}
      onHeaderAction={handleHeaderAction}
      minHeight={400}
    >
      <div ref={listRef} className="retune-variable-dialog-list">
        {filtered.length === 0 && (
          <div className="retune-variable-dialog-empty">No variables found</div>
        )}
        {filtered.map((token, i) => {
          const isActive = currentToken?.className === token.className;
          const isHighlighted = i === highlightedIndex;
          return (
            <div
              key={token.className}
              className={`retune-variable-dialog-item${isActive ? " retune-variable-dialog-item-active" : ""}${isHighlighted ? " retune-variable-dialog-item-highlighted" : ""}`}
              data-token-index={i}
            >
              {isColor && (
                <span
                  className="retune-variable-dialog-swatch"
                  style={{ backgroundColor: getSwatchColor(token) || "transparent" }}
                />
              )}
              <span className="retune-variable-dialog-name">{formatName(token.className)}</span>
              <span className="retune-variable-dialog-value">{formatValue(token)}</span>
            </div>
          );
        })}
      </div>
    </FloatingDialog>
  );
}

/**
 * TokenDialog — floating panel for browsing and selecting tokens.
 * Shows all available semantic tokens for a CSS property with search
 * and category grouping. Replaces TokenPicker for all token interactions.
 *
 * NOTE: Uses native DOM event listeners for clicks because React's event
 * delegation doesn't work inside Shadow DOM portals (see token-indicator.tsx).
 */

import { useEffect, useRef, useMemo, useState } from "react";
import type { UtilityToken } from "../tokens/types";
import { getTokensForProperty } from "../tokens/resolver";
import { getCategoryForProperty } from "../tokens/categories";
import { useScrollLock } from "./use-scroll-lock";

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
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  useScrollLock(true);

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

  // Store refs for native handlers
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;

  // Auto-focus search on mount
  useEffect(() => {
    const timer = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, []);

  // Close on outside click or Escape
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (!e.composedPath().includes(panel)) {
        onCloseRef.current();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    const root = panelRef.current?.getRootNode() as ShadowRoot | Document;
    const timer = setTimeout(() => {
      root.addEventListener("pointerdown", handlePointerDown as EventListener);
    }, 0);
    root.addEventListener("keydown", handleKeyDown as EventListener, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      clearTimeout(timer);
      root.removeEventListener("pointerdown", handlePointerDown as EventListener);
      root.removeEventListener("keydown", handleKeyDown as EventListener, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  // Native click handler for token items
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

  // Native close button handler
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const handleClose = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-close]")) {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    panel.addEventListener("pointerdown", handleClose);
    return () => panel.removeEventListener("pointerdown", handleClose);
  }, []);

  // Position — appear below the anchor, flip up if needed
  const panelWidth = 240;
  const maxHeight = 320;
  const spaceBelow = window.innerHeight - anchorRect.top - anchorRect.height - 4;
  const flipUp = spaceBelow < maxHeight && anchorRect.top > spaceBelow;
  const top = flipUp
    ? Math.max(4, anchorRect.top - maxHeight - 4)
    : anchorRect.top + anchorRect.height + 4;
  const left = Math.max(4, Math.min(
    anchorRect.left + anchorRect.width - panelWidth,
    window.innerWidth - panelWidth - 4,
  ));

  const categoryLabel = category
    ? category.charAt(0).toUpperCase() + category.slice(1)
    : "Tokens";

  return (
    <div
      ref={panelRef}
      className="retune-token-dialog"
      style={{ position: "fixed", top, left, width: panelWidth }}
    >
      <div className="retune-token-dialog-header">
        <span className="retune-token-dialog-title">{categoryLabel}</span>
        <button type="button" className="retune-token-dialog-close" data-close>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M16.6464 6.64645C16.8417 6.45118 17.1582 6.45118 17.3535 6.64645C17.5487 6.84171 17.5487 7.15822 17.3535 7.35348L12.707 12L17.3535 16.6464C17.5487 16.8417 17.5487 17.1582 17.3535 17.3535C17.1582 17.5487 16.8417 17.5487 16.6464 17.3535L12 12.707L7.35348 17.3535C7.15822 17.5487 6.84171 17.5487 6.64645 17.3535C6.45118 17.1582 6.45118 16.8417 6.64645 16.6464L11.2929 12L6.64645 7.35348C6.45123 7.15821 6.4512 6.84169 6.64645 6.64645C6.8417 6.45125 7.15823 6.45125 7.35348 6.64645L12 11.2929L16.6464 6.64645Z" fill="currentColor" />
          </svg>
        </button>
      </div>
      <div className="retune-token-dialog-search">
        <input
          ref={searchRef}
          className="retune-token-dialog-search-input"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          spellCheck={false}
        />
      </div>
      <div ref={listRef} className="retune-token-dialog-list">
        {filtered.length === 0 && (
          <div className="retune-token-dialog-empty">No tokens found</div>
        )}
        {filtered.map((token, i) => {
          const isActive = currentToken?.className === token.className;
          return (
            <div
              key={token.className}
              className={`retune-token-dialog-item${isActive ? " retune-token-dialog-item-active" : ""}`}
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
    </div>
  );
}

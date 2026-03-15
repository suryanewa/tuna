/**
 * TokenPicker — floating panel showing alternative tokens in the same category.
 * Click a token to swap the class on the element.
 * Positioned like ColorPicker: fixed, anchored to the trigger dot.
 *
 * NOTE: Uses native DOM event listeners for clicks because React's event
 * delegation doesn't work inside Shadow DOM portals (see variable-action.tsx).
 */

import { useEffect, useRef, useCallback } from "react";
import type { UtilityToken, TokenMatch } from "../tokens/types";
import { getAlternativeTokens } from "../tokens/resolver";
import { getCategoryForProperty } from "../tokens/categories";

export interface TokenPickerProps {
  match: TokenMatch;
  onSelect: (newToken: UtilityToken) => void;
  onClose: () => void;
  anchorRect: { top: number; left: number; width: number; height: number };
}

/** Format a token value for display (first property value, simplified) */
function formatValue(token: UtilityToken): string {
  const vals = Object.values(token.values);
  if (vals.length === 0) return "";
  const val = vals[0];
  return val.length > 20 ? val.slice(0, 20) + "…" : val;
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

export function TokenPicker({ match, onSelect, onClose, anchorRect }: TokenPickerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const alternatives = getAlternativeTokens(match.property, match.token);
  const category = getCategoryForProperty(match.property);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Store alternatives in a ref for the native event handler
  const alternativesRef = useRef(alternatives);
  alternativesRef.current = alternatives;

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

  // Native click handler for picker items (React delegation doesn't work in Shadow DOM)
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
      const token = alternativesRef.current[idx];
      if (token) {
        onSelectRef.current(token);
        onCloseRef.current();
      }
    };
    list.addEventListener("pointerdown", handleClick);
    return () => list.removeEventListener("pointerdown", handleClick);
  }, []);

  // Position — appear below the anchor
  const panelWidth = 200;
  const itemHeight = 30;
  const padding = 8;
  const maxItems = 8;
  const itemCount = alternatives.length + 1;
  const panelHeight = Math.min(itemCount, maxItems) * itemHeight + padding * 2;

  const spaceBelow = window.innerHeight - anchorRect.top - anchorRect.height - 4;
  const flipUp = spaceBelow < panelHeight && anchorRect.top > spaceBelow;
  const top = flipUp
    ? anchorRect.top - panelHeight - 4
    : anchorRect.top + anchorRect.height + 4;

  const left = Math.max(4, anchorRect.left + anchorRect.width - panelWidth);

  const isColor = category === "colors";

  return (
    <div
      ref={panelRef}
      className="retune-token-picker"
      style={{ position: "fixed", top, left, width: panelWidth }}
    >
      <div className="retune-token-picker-header">
        <span className="retune-token-picker-title">{category || "variables"}</span>
      </div>
      <div ref={listRef} className="retune-token-picker-list">
        {/* Current token */}
        <div className="retune-token-picker-item retune-token-picker-item-active">
          {isColor && (
            <span
              className="retune-token-picker-swatch"
              style={{ backgroundColor: getSwatchColor(match.token) || "transparent" }}
            />
          )}
          <span className="retune-token-picker-name">.{match.token.className}</span>
          <span className="retune-token-picker-value">{formatValue(match.token)}</span>
        </div>
        {/* Alternatives */}
        {alternatives.map((token, i) => (
          <div
            key={token.className}
            className="retune-token-picker-item"
            data-token-index={i}
          >
            {isColor && (
              <span
                className="retune-token-picker-swatch"
                style={{ backgroundColor: getSwatchColor(token) || "transparent" }}
              />
            )}
            <span className="retune-token-picker-name">.{token.className}</span>
            <span className="retune-token-picker-value">{formatValue(token)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

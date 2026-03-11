/**
 * TokenPicker — floating panel for browsing and selecting utility-class tokens.
 * Shows tokens from the same category as the current property, grouped visually.
 * Selecting a token emits a class swap instruction.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { UtilityToken, TokenCategory } from "../tokens/types";
import { getAlternativeTokens } from "../tokens/resolver";

export interface TokenPickerProps {
  /** The CSS property being edited (e.g., "padding-top") */
  property: string;
  /** The currently active token (if any) */
  currentToken?: UtilityToken;
  /** Anchor rect for positioning the popover */
  anchorRect: { top: number; left: number; width: number; height: number };
  /** Called when user selects a token */
  onSelect: (token: UtilityToken) => void;
  /** Called when picker should close */
  onClose: () => void;
  /** Portal target for rendering */
  portalTarget?: HTMLElement;
}

export function TokenPicker({
  property,
  currentToken,
  anchorRect,
  onSelect,
  onClose,
  portalTarget,
}: TokenPickerProps) {
  const [alternatives, setAlternatives] = useState<UtilityToken[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tokens = getAlternativeTokens(property, currentToken);
    setAlternatives(tokens);
  }, [property, currentToken]);

  // Close on click outside
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use capture to catch clicks before they propagate
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Position below the anchor
  const style: React.CSSProperties = {
    position: "fixed",
    top: anchorRect.top + anchorRect.height + 4,
    left: anchorRect.left,
    width: anchorRect.width,
    zIndex: 2147483647,
  };

  // Check if it would overflow viewport bottom
  const viewportH = window.innerHeight;
  if (anchorRect.top + anchorRect.height + 240 > viewportH) {
    // Position above instead
    style.top = anchorRect.top - 240;
  }

  const handleSelect = useCallback((token: UtilityToken) => {
    onSelect(token);
    onClose();
  }, [onSelect, onClose]);

  // Get display value for a token
  const getDisplayValue = (token: UtilityToken): string => {
    const val = token.values[property] || Object.values(token.values)[0];
    return val || "";
  };

  const isColor = property.includes("color") || property === "background-color";

  const content = (
    <div ref={panelRef} className="retune-token-picker" style={style}>
      <div className="retune-token-picker-header">
        {currentToken && (
          <div className="retune-token-picker-current">
            <span className="retune-token-picker-label">Current</span>
            <span className="retune-token-picker-class">.{currentToken.className}</span>
          </div>
        )}
      </div>
      <div className="retune-token-picker-list">
        {alternatives.length === 0 && (
          <div className="retune-token-picker-empty">No alternative tokens found</div>
        )}
        {alternatives.map((token) => {
          const displayVal = getDisplayValue(token);
          return (
            <button
              key={token.className}
              className="retune-token-picker-item"
              onClick={() => handleSelect(token)}
              type="button"
            >
              {isColor && (
                <span
                  className="retune-token-picker-swatch"
                  style={{ backgroundColor: displayVal }}
                />
              )}
              <span className="retune-token-picker-item-name">.{token.className}</span>
              <span className="retune-token-picker-item-value">{displayVal}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  if (portalTarget) {
    return createPortal(content, portalTarget);
  }
  return content;
}

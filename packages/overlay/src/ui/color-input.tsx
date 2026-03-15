/**
 * ColorInput — color swatch + hex input + opacity input.
 * Layout: [swatch | hex] [opacity %]
 * Clicking the swatch opens a floating ColorPicker panel.
 */

import { useState, useRef, useCallback } from "react";
import { parseCssColor, hexToRgba } from "./color-utils";
import { ColorPicker } from "./color-picker";
import type { TokenMatch, UtilityToken } from "../tokens/types";
import { TokenIndicator } from "./token-indicator";
import { claimDialog, releaseDialog } from "./dialog-singleton";

export interface ColorInputProps {
  prop: string;
  value: string | undefined;
  onChange: (prop: string, value: string) => void;
  tokenMatch?: TokenMatch;
  property?: string;
  onTokenSelect?: (oldToken: import("../tokens/types").UtilityToken, newToken: import("../tokens/types").UtilityToken) => void;
  onTokenApply?: (token: import("../tokens/types").UtilityToken, properties: string[]) => void;
  onTokenUnlink?: () => void;
}

export function ColorInput({ prop, value, onChange, tokenMatch, property, onTokenSelect, onTokenApply, onTokenUnlink }: ColorInputProps) {
  const parsed = parseCssColor(value || "");
  const [hexLocal, setHexLocal] = useState(parsed.hex.replace("#", "").toUpperCase());
  const [opacityLocal, setOpacityLocal] = useState(String(parsed.opacity));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<"custom" | "tokens">("custom");
  const [anchorRect, setAnchorRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const swatchRef = useRef<HTMLDivElement>(null);
  const hexFocusedRef = useRef(false);
  const opacityFocusedRef = useRef(false);
  const stableCloseRef = useRef(() => setPickerOpen(false));

  // Track current hex and opacity as refs for building CSS output
  const currentHexRef = useRef(parsed.hex);
  const currentOpacityRef = useRef(parsed.opacity);

  // Sync from parent
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    const p = parseCssColor(value || "");
    currentHexRef.current = p.hex;
    currentOpacityRef.current = p.opacity;
    if (!hexFocusedRef.current) {
      setHexLocal(p.hex.replace("#", "").toUpperCase());
    }
    if (!opacityFocusedRef.current) {
      setOpacityLocal(String(p.opacity));
    }
  }

  // Build and emit CSS color value
  const emitColor = useCallback((hex: string, opacity: number) => {
    currentHexRef.current = hex;
    currentOpacityRef.current = opacity;
    onChange(prop, hexToRgba(hex, opacity));
  }, [prop, onChange]);

  // ── Swatch click → open picker (Custom tab) ──
  const handleSwatchClick = useCallback(() => {
    if (pickerOpen) {
      releaseDialog(stableCloseRef.current);
      setPickerOpen(false);
      return;
    }
    openPicker("custom");
  }, [pickerOpen]);

  // Shared open logic — computes anchor rect and opens to the given tab
  const openPicker = useCallback((tab: "custom" | "tokens") => {
    const el = swatchRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const row = el.closest(".retune-row");
    if (row) {
      const rowRect = row.getBoundingClientRect();
      setAnchorRect({ top: rect.top, left: rowRect.left, width: rowRect.width, height: rect.height });
    } else {
      setAnchorRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    }
    setInitialTab(tab);
    setPickerOpen(true);
    claimDialog(stableCloseRef.current);
  }, []);

  // Token dot click → open picker to Variables tab
  const handleTokenDotOpen = useCallback(() => {
    if (pickerOpen) {
      releaseDialog(stableCloseRef.current);
      setPickerOpen(false);
      return;
    }
    openPicker("tokens");
  }, [pickerOpen, openPicker]);

  // ── Picker callbacks ──
  const handlePickerChange = useCallback((hex: string) => {
    setHexLocal(hex.replace("#", "").toUpperCase());
    emitColor(hex, currentOpacityRef.current);
  }, [emitColor]);

  const handlePickerAlphaChange = useCallback((alpha: number) => {
    setOpacityLocal(String(alpha));
    emitColor(currentHexRef.current, alpha);
  }, [emitColor]);

  const handlePickerClose = useCallback(() => {
    releaseDialog(stableCloseRef.current);
    setPickerOpen(false);
  }, []);

  // Token apply from within the color picker (tokens tab)
  const handlePickerTokenApply = useCallback((token: UtilityToken, properties: string[]) => {
    onTokenApply?.(token, properties);
    releaseDialog(stableCloseRef.current);
    setPickerOpen(false);
  }, [onTokenApply]);

  const handlePickerTokenSelect = useCallback((oldToken: UtilityToken, newToken: UtilityToken) => {
    onTokenSelect?.(oldToken, newToken);
    releaseDialog(stableCloseRef.current);
    setPickerOpen(false);
  }, [onTokenSelect]);

  // ── Hex input ──
  const commitHex = useCallback(() => {
    hexFocusedRef.current = false;
    let cleaned = hexLocal.replace(/^#/, "").trim();
    if (cleaned.length === 3) {
      cleaned = cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2];
    }
    if (/^[a-fA-F0-9]{6}$/.test(cleaned)) {
      setHexLocal(cleaned.toUpperCase());
      emitColor(`#${cleaned}`, currentOpacityRef.current);
    } else {
      // Revert to current
      setHexLocal(currentHexRef.current.replace("#", "").toUpperCase());
    }
  }, [hexLocal, emitColor]);

  // ── Opacity input ──
  const commitOpacity = useCallback(() => {
    opacityFocusedRef.current = false;
    const val = Math.max(0, Math.min(100, Math.round(Number(opacityLocal) || 0)));
    setOpacityLocal(String(val));
    emitColor(currentHexRef.current, val);
  }, [opacityLocal, emitColor]);

  const handleOpacityKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      // Read from the input element directly to avoid stale state
      const current = Math.round(Number(e.currentTarget.value) || 0);
      const step = e.shiftKey ? 10 : 1;
      const delta = e.key === "ArrowUp" ? step : -step;
      const newVal = Math.max(0, Math.min(100, current + delta));
      setOpacityLocal(String(newVal));
      emitColor(currentHexRef.current, newVal);
    }
  }, [emitColor]);

  // Swatch display: split view when opacity < 100 (left=solid, right=with opacity over checkerboard)
  const swatchStyle = (() => {
    const hex = currentHexRef.current;
    const op = currentOpacityRef.current;
    if (op >= 100) {
      return { backgroundColor: hex, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)" } as React.CSSProperties;
    }
    const checkerboard = "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)";
    const transparentColor = hexToRgba(hex, op);
    return {
      backgroundImage: `linear-gradient(to right, ${hex} 50%, ${transparentColor} 50%), ${checkerboard}`,
      backgroundSize: "100% 100%, 4px 4px, 4px 4px",
      backgroundPosition: "0 0, 0 0, 2px 2px",
      boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
    } as React.CSSProperties;
  })();

  return (
    <div className={`retune-color-row${tokenMatch ? " retune-prop-has-token" : ""}`}>
      {/* Left half: swatch + hex */}
      <div className="retune-color-hex-section">
        <div
          ref={swatchRef}
          className="retune-color-swatch"
          onClick={handleSwatchClick}
        >
          <div className="retune-color-swatch-inner" style={swatchStyle} />
        </div>
        <input
          className="retune-color-hex-input"
          value={hexLocal}
          onChange={(e) => setHexLocal(e.target.value.replace(/[^a-fA-F0-9]/g, "").slice(0, 6))}
          onFocus={(e) => { hexFocusedRef.current = true; e.target.select(); }}
          onBlur={commitHex}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          spellCheck={false}
        />
        <TokenIndicator
          match={tokenMatch}
          property={property || prop}
          onTokenSelect={onTokenSelect}
          onTokenApply={onTokenApply}
          onTokenUnlink={onTokenUnlink}
          onRequestOpen={handleTokenDotOpen}
        />
      </div>

      {/* Right half: opacity */}
      <div className="retune-color-opacity-section">
        <input
          className="retune-color-opacity-input"
          inputMode="numeric"
          value={opacityLocal}
          onChange={(e) => setOpacityLocal(e.target.value)}
          onFocus={(e) => { opacityFocusedRef.current = true; e.target.select(); }}
          onBlur={commitOpacity}
          onKeyDown={handleOpacityKeyDown}
        />
        <span className="retune-color-opacity-unit">%</span>
      </div>

      {pickerOpen && anchorRect && (
        <ColorPicker
          value={currentHexRef.current}
          alpha={currentOpacityRef.current}
          onChange={handlePickerChange}
          onAlphaChange={handlePickerAlphaChange}
          onClose={handlePickerClose}
          anchorRect={anchorRect}
          property={property || prop}
          currentToken={tokenMatch?.token}
          onTokenSelect={handlePickerTokenSelect}
          onTokenApply={handlePickerTokenApply}
          initialTab={initialTab}
        />
      )}
    </div>
  );
}


/**
 * ColorInput — color swatch + hex input + opacity input.
 * Layout: [swatch | hex] [opacity %]
 * Clicking the swatch opens a floating ColorPicker panel.
 */

import { useState, useRef, useCallback } from "react";
import { parseCssColor, hexToRgba } from "./color-utils";
import { ColorPicker } from "./color-picker";

export interface ColorInputProps {
  prop: string;
  value: string | undefined;
  onChange: (prop: string, value: string) => void;
}

export function ColorInput({ prop, value, onChange }: ColorInputProps) {
  const parsed = parseCssColor(value || "");
  const [hexLocal, setHexLocal] = useState(parsed.hex.replace("#", "").toUpperCase());
  const [opacityLocal, setOpacityLocal] = useState(String(parsed.opacity));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const swatchRef = useRef<HTMLDivElement>(null);
  const hexFocusedRef = useRef(false);
  const opacityFocusedRef = useRef(false);

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

  // ── Swatch click → open picker ──
  const handleSwatchClick = useCallback(() => {
    if (pickerOpen) {
      setPickerOpen(false);
      return;
    }
    const el = swatchRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Match picker width to the row content area
    const row = el.closest(".composer-row");
    if (row) {
      const rowRect = row.getBoundingClientRect();
      setAnchorRect({ top: rect.top, left: rowRect.left, width: rowRect.width, height: rect.height });
    } else {
      setAnchorRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    }
    setPickerOpen(true);
  }, [pickerOpen]);

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
    setPickerOpen(false);
  }, []);

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
      const current = Math.round(Number(opacityLocal) || 0);
      const step = e.shiftKey ? 10 : 1;
      const delta = e.key === "ArrowUp" ? step : -step;
      const newVal = Math.max(0, Math.min(100, current + delta));
      setOpacityLocal(String(newVal));
      emitColor(currentHexRef.current, newVal);
    }
  }, [opacityLocal, emitColor]);

  // Swatch display: show color with opacity
  const swatchColor = currentOpacityRef.current < 100
    ? hexToRgba(currentHexRef.current, currentOpacityRef.current)
    : currentHexRef.current;

  return (
    <div className="composer-color-row">
      {/* Left half: swatch + hex */}
      <div className="composer-color-hex-section">
        <div
          ref={swatchRef}
          className="composer-color-swatch"
          onClick={handleSwatchClick}
        >
          <div className="composer-color-swatch-inner">
            <div className="composer-color-swatch-fill" style={{ background: swatchColor }} />
          </div>
        </div>
        <input
          className="composer-color-hex-input"
          value={hexLocal}
          onChange={(e) => setHexLocal(e.target.value.replace(/[^a-fA-F0-9]/g, "").slice(0, 6))}
          onFocus={() => { hexFocusedRef.current = true; }}
          onBlur={commitHex}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          spellCheck={false}
        />
      </div>

      {/* Right half: opacity */}
      <div className="composer-color-opacity-section">
        <input
          className="composer-color-opacity-input"
          inputMode="numeric"
          value={opacityLocal}
          onChange={(e) => setOpacityLocal(e.target.value)}
          onFocus={() => { opacityFocusedRef.current = true; }}
          onBlur={commitOpacity}
          onKeyDown={handleOpacityKeyDown}
        />
        <span className="composer-color-opacity-unit">%</span>
      </div>

      {pickerOpen && anchorRect && (
        <ColorPicker
          value={currentHexRef.current}
          alpha={currentOpacityRef.current}
          onChange={handlePickerChange}
          onAlphaChange={handlePickerAlphaChange}
          onClose={handlePickerClose}
          anchorRect={anchorRect}
        />
      )}
    </div>
  );
}

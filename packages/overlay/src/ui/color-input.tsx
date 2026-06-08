/**
 * ColorInput — color swatch + hex input + opacity input.
 * Layout: [swatch | hex] [opacity %]
 * Clicking the swatch opens a floating ColorPicker panel.
 */

import { useState, useRef, useCallback } from "react";
import { parseCssColor, hexToRgba } from "./color-utils";
import { ColorPicker } from "./color-picker";
import type { VariableMatch, DesignVariable } from "../variables/types";
import { ChangeIndicator } from "./change-indicator";
import { VariableAction } from "./variable-action";
import { claimDialog, releaseDialog } from "./dialog-singleton";
import { isMixedValue, MIXED_LABEL } from "./mixed-value";

export interface ColorInputProps {
  prop: string;
  value: string | undefined;
  onChange: (prop: string, value: string) => void;
  variableMatch?: VariableMatch;
  property?: string;
  onVariableSelect?: (oldToken: import("../variables/types").DesignVariable, newToken: import("../variables/types").DesignVariable, properties?: string[]) => void;
  onVariableApply?: (token: import("../variables/types").DesignVariable, properties: string[]) => void;
  onVariableUnlink?: () => void;
  /** Whether this property has been changed from its original value */
  isChanged?: boolean;
  /** Reset this property to its original value */
  onReset?: () => void;
}

/** Format variable name for display: var(--color-brand) → "color-brand" */
function formatVarName(className: string): string {
  if (className.startsWith("var(--") && className.endsWith(")")) {
    return className.slice(6, -1);
  }
  return className;
}

export function ColorInput({ prop, value, onChange, variableMatch, property, onVariableSelect, onVariableApply, onVariableUnlink, isChanged, onReset }: ColorInputProps) {
  const mixed = isMixedValue(value);
  const parsed = parseCssColor(mixed ? "" : value || "");
  const [hexLocal, setHexLocal] = useState(mixed ? MIXED_LABEL : parsed.hex.replace("#", "").toUpperCase());
  const [opacityLocal, setOpacityLocal] = useState(mixed ? MIXED_LABEL : String(parsed.opacity));
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
    const mixedValue = isMixedValue(value);
    const p = parseCssColor(mixedValue ? "" : value || "");
    currentHexRef.current = p.hex;
    currentOpacityRef.current = p.opacity;
    if (!hexFocusedRef.current) {
      setHexLocal(mixedValue ? MIXED_LABEL : p.hex.replace("#", "").toUpperCase());
    }
    if (!opacityFocusedRef.current) {
      setOpacityLocal(mixedValue ? MIXED_LABEL : String(p.opacity));
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
  const handlePickerVariableApply = useCallback((variable: DesignVariable, properties: string[]) => {
    onVariableApply?.(variable, properties);
    releaseDialog(stableCloseRef.current);
    setPickerOpen(false);
  }, [onVariableApply]);

  const handlePickerTokenSelect = useCallback((oldToken: DesignVariable, newToken: DesignVariable, properties?: string[]) => {
    onVariableSelect?.(oldToken, newToken, properties);
    releaseDialog(stableCloseRef.current);
    setPickerOpen(false);
  }, [onVariableSelect]);

  // ── Hex input ──
  const commitHex = useCallback(() => {
    hexFocusedRef.current = false;
    let cleaned = hexLocal.replace(/^#/, "").trim();
    if (mixed && cleaned === "") {
      setHexLocal(MIXED_LABEL);
      return;
    }
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
  }, [mixed, hexLocal, emitColor]);

  // ── Opacity input ──
  const commitOpacity = useCallback(() => {
    opacityFocusedRef.current = false;
    if (mixed && opacityLocal.trim() === "") {
      setOpacityLocal(MIXED_LABEL);
      return;
    }
    const val = Math.max(0, Math.min(100, Math.round(Number(opacityLocal) || 0)));
    setOpacityLocal(String(val));
    emitColor(currentHexRef.current, val);
  }, [mixed, opacityLocal, emitColor]);

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

  // Detect "none" / "transparent" state
  const isNone = !mixed && (!value || value === "none" || value === "transparent" || (currentHexRef.current === "#000000" && currentOpacityRef.current === 0));

  // Swatch display: split view when opacity < 100 (left=solid, right=with opacity over checkerboard)
  const swatchStyle = (() => {
    if (mixed) {
      return { backgroundColor: "transparent", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.18)" } as React.CSSProperties;
    }
    if (isNone) {
      return { backgroundColor: "#fff", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)" } as React.CSSProperties;
    }
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
    <div className="retune-color-row">
      <ChangeIndicator isChanged={isChanged ?? false} onReset={onReset ?? (() => {})} />
      {/* Left half: swatch + hex (or variable name when token applied) */}
      <div className={`retune-color-hex-section${variableMatch ? " retune-color-variable-applied" : ""}`}>
        <div
          ref={swatchRef}
          className="retune-color-swatch"
          onClick={variableMatch ? handleTokenDotOpen : handleSwatchClick}
        >
          <div className="retune-color-swatch-inner" style={swatchStyle}>
            {isNone && (
              <svg width="100%" height="100%" viewBox="0 0 16 16" style={{ position: "absolute", top: 0, left: 0 }}>
                <line x1="3" y1="13" x2="13" y2="3" stroke="var(--retune-red-500)" strokeWidth="1" strokeLinecap="round" />
              </svg>
            )}
          </div>
        </div>
        <input
          className="retune-color-hex-input"
          value={mixed ? MIXED_LABEL : isNone ? "None" : variableMatch ? formatVarName(variableMatch.variable.className) : hexLocal}
          readOnly={!!variableMatch}
          onClick={variableMatch ? handleTokenDotOpen : undefined}
          onChange={variableMatch ? undefined : (e) => setHexLocal(e.target.value.replace(/[^a-fA-F0-9]/g, "").slice(0, 6))}
          onFocus={variableMatch ? undefined : (e) => { hexFocusedRef.current = true; if (mixed) setHexLocal(""); e.target.select(); }}
          onBlur={variableMatch ? undefined : commitHex}
          onKeyDown={variableMatch ? undefined : (e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          spellCheck={false}
        />
        <VariableAction
          match={variableMatch}
          property={property || prop}
          onVariableSelect={onVariableSelect}
          onVariableApply={onVariableApply}
          onVariableUnlink={onVariableUnlink}
          onRequestOpen={handleTokenDotOpen}
        />
      </div>

      {/* Right half: opacity — hidden when variable is applied */}
      {!variableMatch && (
        <div className="retune-color-opacity-section">
          <input
            className="retune-color-opacity-input"
            inputMode="numeric"
            value={opacityLocal}
            onChange={(e) => setOpacityLocal(e.target.value)}
            onFocus={(e) => { opacityFocusedRef.current = true; if (mixed) setOpacityLocal(""); e.target.select(); }}
            onBlur={commitOpacity}
            onKeyDown={handleOpacityKeyDown}
          />
          <span className="retune-color-opacity-unit">%</span>
        </div>
      )}

      {pickerOpen && anchorRect && (
        <ColorPicker
          value={currentHexRef.current}
          alpha={currentOpacityRef.current}
          onChange={handlePickerChange}
          onAlphaChange={handlePickerAlphaChange}
          onClose={handlePickerClose}
          anchorRect={anchorRect}
          property={property || prop}
          currentVariable={variableMatch?.variable}
          onVariableSelect={handlePickerTokenSelect}
          onVariableApply={handlePickerVariableApply}
          onVariableUnlink={onVariableUnlink}
          initialTab={initialTab}
        />
      )}
    </div>
  );
}


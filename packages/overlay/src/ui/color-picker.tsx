/**
 * ColorPicker — floating color picker with SV area, hue slider, alpha slider, and hex/RGB inputs.
 * Uses FloatingDialog as the shell (positioning, header, close handling).
 *
 * When token props are provided and color tokens exist, renders with tabs:
 * "Custom" (picker) and "{Category}" (token list) — matching the portfolio's
 * ColorPickerDialog pattern.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  type HSVA,
  hexToHsva,
  hsvaToHex,
  hsvToHex,
  hsvToRgb,
  rgbToHsv,
  hexToRgb,
  rgbToHex,
} from "./color-utils";
import { FloatingDialog } from "./floating-dialog";
import type { UtilityToken } from "../tokens/types";
import { getTokensForProperty } from "../tokens/resolver";
import { getCategoryForProperty } from "../tokens/categories";

export interface ColorPickerProps {
  value: string; // hex color
  alpha?: number; // 0-100
  onChange: (hex: string) => void;
  onAlphaChange?: (alpha: number) => void;
  onClose: () => void;
  anchorRect: { top: number; left: number; width: number; height: number };
  // Token integration
  property?: string;
  currentToken?: UtilityToken;
  onTokenSelect?: (oldToken: UtilityToken, newToken: UtilityToken) => void;
  onTokenApply?: (token: UtilityToken, properties: string[]) => void;
  initialTab?: "custom" | "tokens";
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Format a token value for display */
function formatTokenValue(token: UtilityToken): string {
  const vals = Object.values(token.values);
  if (vals.length === 0) return "";
  const val = vals[0];
  return val.length > 20 ? val.slice(0, 20) + "\u2026" : val;
}

/** Get a swatch color from a token */
function getSwatchColor(token: UtilityToken): string | null {
  for (const [prop, val] of Object.entries(token.values)) {
    if (prop.includes("color") || prop === "background-color" || prop === "fill" || prop === "stroke") {
      return val;
    }
  }
  return null;
}

export function ColorPicker({
  value, alpha = 100, onChange, onAlphaChange, onClose, anchorRect,
  property, currentToken, onTokenSelect, onTokenApply, initialTab,
}: ColorPickerProps) {
  const [hsva, setHsva] = useState<HSVA>(() => hexToHsva(value || "#000000"));
  const lastSentRef = useRef("");
  const dragCleanupRef = useRef<(() => void) | null>(null);

  // ── Token tab support ─────────────────────────────────────────────
  const allTokens = useMemo(() => property ? getTokensForProperty(property) : [], [property]);
  const category = property
    ? getCategoryForProperty(property.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`))
    : null;
  const hasTokens = allTokens.length > 0;

  const [activeTab, setActiveTab] = useState(initialTab || "custom");
  const [tokenSearch, setTokenSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const tokenListRef = useRef<HTMLDivElement>(null);

  // Sync initialTab when it changes (e.g. reopened to a different tab)
  const prevInitialTab = useRef(initialTab);
  if (initialTab !== prevInitialTab.current) {
    prevInitialTab.current = initialTab;
    if (initialTab) setActiveTab(initialTab);
  }

  const filteredTokens = useMemo(() => {
    if (!tokenSearch) return allTokens;
    const q = tokenSearch.toLowerCase();
    return allTokens.filter(t =>
      t.className.toLowerCase().includes(q) ||
      Object.values(t.values).some(v => v.toLowerCase().includes(q))
    );
  }, [allTokens, tokenSearch]);

  // Reset highlight when filtered list changes
  useEffect(() => { setHighlightedIndex(-1); }, [filteredTokens]);

  // Auto-scroll highlighted token into view
  useEffect(() => {
    if (highlightedIndex < 0) return;
    const list = tokenListRef.current;
    if (!list) return;
    const item = list.querySelector(`[data-token-index="${highlightedIndex}"]`);
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  // Refs for native token handlers
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onTokenSelectRef = useRef(onTokenSelect);
  onTokenSelectRef.current = onTokenSelect;
  const onTokenApplyRef = useRef(onTokenApply);
  onTokenApplyRef.current = onTokenApply;
  const currentTokenRef = useRef(currentToken);
  currentTokenRef.current = currentToken;
  const filteredTokensRef = useRef(filteredTokens);
  filteredTokensRef.current = filteredTokens;
  const propertyRef = useRef(property);
  propertyRef.current = property;

  // Keyboard nav for token search
  const handleTokenSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = filteredTokensRef.current.length;
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
          const token = filteredTokensRef.current[curr];
          if (token) {
            if (currentTokenRef.current) {
              onTokenSelectRef.current?.(currentTokenRef.current, token);
            } else {
              onTokenApplyRef.current?.(token, propertyRef.current ? [propertyRef.current] : []);
            }
            onCloseRef.current();
          }
        }
        return curr;
      });
    }
  }, []);

  // Native click handler for token items
  useEffect(() => {
    const list = tokenListRef.current;
    if (!list) return;
    const handleClick = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      const item = target.closest<HTMLElement>("[data-token-index]");
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(item.dataset.tokenIndex!, 10);
      const token = filteredTokensRef.current[idx];
      if (token) {
        if (currentTokenRef.current) {
          onTokenSelectRef.current?.(currentTokenRef.current, token);
        } else {
          onTokenApplyRef.current?.(token, propertyRef.current ? [propertyRef.current] : []);
        }
        onCloseRef.current();
      }
    };
    list.addEventListener("pointerdown", handleClick);
    return () => list.removeEventListener("pointerdown", handleClick);
  }, []);

  // ── Color picker state ────────────────────────────────────────────

  // Clean up any active drag listeners on unmount
  useEffect(() => {
    return () => { dragCleanupRef.current?.(); };
  }, []);

  // Sync from parent when value changes externally
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value !== lastSentRef.current) {
      setHsva(hexToHsva(value || "#000000"));
    }
  }

  // Hex input local state
  const [hexInput, setHexInput] = useState(() =>
    hsvToHex(hsva.h, hsva.s, hsva.v).replace("#", "").toUpperCase()
  );
  const [rgbInputs, setRgbInputs] = useState(() => {
    const { r, g, b } = hsvToRgb(hsva.h, hsva.s, hsva.v);
    return { r: String(r), g: String(g), b: String(b) };
  });
  const focusedRef = useRef<string | null>(null);

  // Sync local inputs from hsva when not focused
  const [prevHsva, setPrevHsva] = useState(hsva);
  if (hsva !== prevHsva) {
    setPrevHsva(hsva);
    if (!focusedRef.current) {
      setHexInput(hsvToHex(hsva.h, hsva.s, hsva.v).replace("#", "").toUpperCase());
      const { r, g, b } = hsvToRgb(hsva.h, hsva.s, hsva.v);
      setRgbInputs({ r: String(r), g: String(g), b: String(b) });
    }
  }

  const emitChange = useCallback((newHsva: HSVA) => {
    setHsva(newHsva);
    const hex = hsvaToHex(newHsva);
    lastSentRef.current = hex;
    onChange(hex);
  }, [onChange]);

  // ── SV Picker ───────────────────────────────────────────────────────

  const svRef = useRef<HTMLDivElement>(null);

  const getSV = useCallback((clientX: number, clientY: number) => {
    if (!svRef.current) return null;
    const rect = svRef.current.getBoundingClientRect();
    const s = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const v = clamp((1 - (clientY - rect.top) / rect.height) * 100, 0, 100);
    return { s, v };
  }, []);

  const hsvaRef = useRef(hsva);
  hsvaRef.current = hsva;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleSVPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const result = getSV(e.clientX, e.clientY);
    if (result) emitChange({ ...hsvaRef.current, s: result.s, v: result.v });

    const handleMove = (me: PointerEvent) => {
      const r = getSV(me.clientX, me.clientY);
      if (r) {
        const next = { ...hsvaRef.current, s: r.s, v: r.v };
        const hex = hsvaToHex(next);
        lastSentRef.current = hex;
        setHsva(next);
        onChangeRef.current(hex);
      }
    };
    const handleUp = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      dragCleanupRef.current = null;
    };
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    dragCleanupRef.current = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
    };
  }, [getSV, emitChange]);

  // ── Hue Slider ──────────────────────────────────────────────────────

  const hueRef = useRef<HTMLDivElement>(null);

  const getHue = useCallback((clientX: number) => {
    if (!hueRef.current) return 0;
    const rect = hueRef.current.getBoundingClientRect();
    return clamp(((clientX - rect.left) / rect.width) * 360, 0, 360);
  }, []);

  const handleHuePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    emitChange({ ...hsvaRef.current, h: getHue(e.clientX) });

    const handleMove = (me: PointerEvent) => {
      const h = getHue(me.clientX);
      const next = { ...hsvaRef.current, h };
      const hex = hsvaToHex(next);
      lastSentRef.current = hex;
      setHsva(next);
      onChangeRef.current(hex);
    };
    const handleUp = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      dragCleanupRef.current = null;
    };
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    dragCleanupRef.current = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
    };
  }, [getHue, emitChange]);

  // ── Alpha Slider ───────────────────────────────────────────────────

  const alphaSliderRef = useRef<HTMLDivElement>(null);
  const [localAlpha, setLocalAlpha] = useState(alpha);
  const onAlphaChangeRef = useRef(onAlphaChange);
  onAlphaChangeRef.current = onAlphaChange;

  const [prevAlpha, setPrevAlpha] = useState(alpha);
  if (alpha !== prevAlpha) {
    setPrevAlpha(alpha);
    setLocalAlpha(alpha);
  }

  const getAlpha = useCallback((clientX: number) => {
    if (!alphaSliderRef.current) return 100;
    const rect = alphaSliderRef.current.getBoundingClientRect();
    return clamp(Math.round(((clientX - rect.left) / rect.width) * 100), 0, 100);
  }, []);

  const handleAlphaPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const a = getAlpha(e.clientX);
    setLocalAlpha(a);
    onAlphaChangeRef.current?.(a);

    const handleMove = (me: PointerEvent) => {
      const a = getAlpha(me.clientX);
      setLocalAlpha(a);
      onAlphaChangeRef.current?.(a);
    };
    const handleUp = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      dragCleanupRef.current = null;
    };
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    dragCleanupRef.current = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
    };
  }, [getAlpha]);

  // ── Hex commit ──────────────────────────────────────────────────────

  const commitHex = useCallback(() => {
    focusedRef.current = null;
    let cleaned = hexInput.replace(/^#/, "").trim();
    if (cleaned.length === 3) {
      cleaned = cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2];
    }
    if (/^[a-fA-F0-9]{6}$/.test(cleaned)) {
      const newHsva = hexToHsva(`#${cleaned}`, hsva.a);
      emitChange(newHsva);
      setHexInput(cleaned.toUpperCase());
    } else {
      setHexInput(hsvToHex(hsva.h, hsva.s, hsva.v).replace("#", "").toUpperCase());
    }
  }, [hexInput, hsva, emitChange]);

  // ── RGB commit ──────────────────────────────────────────────────────

  const commitRgb = useCallback(() => {
    focusedRef.current = null;
    const r = clamp(Math.round(Number(rgbInputs.r) || 0), 0, 255);
    const g = clamp(Math.round(Number(rgbInputs.g) || 0), 0, 255);
    const b = clamp(Math.round(Number(rgbInputs.b) || 0), 0, 255);
    const { h, s, v } = rgbToHsv(r, g, b);
    emitChange({ h, s, v, a: hsva.a });
    setRgbInputs({ r: String(r), g: String(g), b: String(b) });
  }, [rgbInputs, hsva.a, emitChange]);

  const handleInputKeyDown = useCallback(
    (commitFn: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
        commitFn();
      }
    },
    []
  );

  // ── Render ────────────────────────────────────────────────────────

  const currentHex = hsvToHex(hsva.h, hsva.s, hsva.v);
  const handleLeft = hsva.s;
  const handleTop = 100 - hsva.v;

  const categoryLabel = category
    ? category.charAt(0).toUpperCase() + category.slice(1)
    : "Tokens";

  const pickerContent = (
    <>
      {/* SV Picker */}
      <div className="retune-cp-sv-wrap">
      <div
        ref={svRef}
        className="retune-cp-sv"
        style={{ backgroundColor: `hsl(${hsva.h}, 100%, 50%)` }}
        onPointerDown={handleSVPointerDown}
      >
        <div className="retune-cp-sv-white" />
        <div className="retune-cp-sv-black" />
        <div
          className="retune-cp-handle"
          style={{ left: `${handleLeft}%`, top: `${handleTop}%` }}
        >
          <div className="retune-cp-handle-inner" style={{ backgroundColor: currentHex }} />
        </div>
      </div>
      </div>

      {/* Sliders */}
      <div className="retune-cp-sliders">
        <div className="retune-cp-preview-wrap">
          <div className="retune-cp-preview-checker" />
          <div
            className="retune-cp-preview"
            style={{ backgroundColor: localAlpha < 100
              ? `rgba(${hsvToRgb(hsva.h, hsva.s, hsva.v).r}, ${hsvToRgb(hsva.h, hsva.s, hsva.v).g}, ${hsvToRgb(hsva.h, hsva.s, hsva.v).b}, ${localAlpha / 100})`
              : currentHex
            }}
          />
        </div>
        <div className="retune-cp-slider-tracks">
          <div ref={hueRef} className="retune-cp-hue" onPointerDown={handleHuePointerDown}>
            <div className="retune-cp-handle" style={{ left: `${(hsva.h / 360) * 100}%`, top: "50%" }}>
              <div className="retune-cp-handle-inner" style={{ backgroundColor: `hsl(${hsva.h}, 100%, 50%)` }} />
            </div>
          </div>
          <div ref={alphaSliderRef} className="retune-cp-alpha" onPointerDown={handleAlphaPointerDown}>
            <div className="retune-cp-alpha-checker" />
            <div className="retune-cp-alpha-gradient" style={{ background: `linear-gradient(to right, transparent, ${currentHex})` }} />
            <div className="retune-cp-handle" style={{ left: `${localAlpha}%`, top: "50%" }}>
              <div className="retune-cp-handle-inner" style={{ backgroundColor: localAlpha < 100
                ? `rgba(${hsvToRgb(hsva.h, hsva.s, hsva.v).r}, ${hsvToRgb(hsva.h, hsva.s, hsva.v).g}, ${hsvToRgb(hsva.h, hsva.s, hsva.v).b}, ${localAlpha / 100})`
                : currentHex
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Inputs */}
      <div className="retune-cp-inputs">
        <div className="retune-cp-input-group">
          <label className="retune-cp-label">Hex</label>
          <input className="retune-cp-input" value={hexInput} onChange={(e) => setHexInput(e.target.value)} onFocus={(e) => { focusedRef.current = "hex"; e.target.select(); }} onBlur={commitHex} onKeyDown={handleInputKeyDown(commitHex)} spellCheck={false} />
        </div>
        <div className="retune-cp-input-group">
          <label className="retune-cp-label">R</label>
          <input className="retune-cp-input" inputMode="numeric" value={rgbInputs.r} onChange={(e) => setRgbInputs(prev => ({ ...prev, r: e.target.value }))} onFocus={(e) => { focusedRef.current = "r"; e.target.select(); }} onBlur={commitRgb} onKeyDown={handleInputKeyDown(commitRgb)} />
        </div>
        <div className="retune-cp-input-group">
          <label className="retune-cp-label">G</label>
          <input className="retune-cp-input" inputMode="numeric" value={rgbInputs.g} onChange={(e) => setRgbInputs(prev => ({ ...prev, g: e.target.value }))} onFocus={(e) => { focusedRef.current = "g"; e.target.select(); }} onBlur={commitRgb} onKeyDown={handleInputKeyDown(commitRgb)} />
        </div>
        <div className="retune-cp-input-group">
          <label className="retune-cp-label">B</label>
          <input className="retune-cp-input" inputMode="numeric" value={rgbInputs.b} onChange={(e) => setRgbInputs(prev => ({ ...prev, b: e.target.value }))} onFocus={(e) => { focusedRef.current = "b"; e.target.select(); }} onBlur={commitRgb} onKeyDown={handleInputKeyDown(commitRgb)} />
        </div>
      </div>
    </>
  );

  const tokenContent = (
    <div ref={tokenListRef} className="retune-token-dialog-list">
      {filteredTokens.length === 0 && (
        <div className="retune-token-dialog-empty">No tokens found</div>
      )}
      {filteredTokens.map((token, i) => {
        const isActive = currentToken?.className === token.className;
        const isHighlighted = i === highlightedIndex;
        return (
          <div
            key={token.className}
            className={`retune-token-dialog-item${isActive ? " retune-token-dialog-item-active" : ""}${isHighlighted ? " retune-token-dialog-item-highlighted" : ""}`}
            data-token-index={i}
          >
            {isActive && <span className="retune-token-dialog-active-dot" />}
            <span
              className="retune-token-dialog-swatch"
              style={{ backgroundColor: getSwatchColor(token) || "transparent" }}
            />
            <span className="retune-token-dialog-name">{token.className}</span>
          </div>
        );
      })}
    </div>
  );

  if (hasTokens) {
    return (
      <FloatingDialog
        tabs={[
          { value: "custom", label: "Custom" },
          { value: "tokens", label: categoryLabel },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClose={onClose}
        anchorRect={anchorRect}
        search={activeTab === "tokens" ? { value: tokenSearch, onChange: setTokenSearch, placeholder: "Search", onKeyDown: handleTokenSearchKeyDown } : undefined}
        minHeight={activeTab === "tokens" ? 300 : undefined}
      >
        {activeTab === "tokens" ? tokenContent : pickerContent}
      </FloatingDialog>
    );
  }

  return (
    <FloatingDialog title="Color" onClose={onClose} anchorRect={anchorRect}>
      {pickerContent}
    </FloatingDialog>
  );
}

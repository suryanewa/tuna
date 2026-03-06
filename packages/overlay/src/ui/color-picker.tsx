/**
 * ColorPicker — floating color picker panel with SV area, hue slider, and hex/RGB inputs.
 * Ported from the portfolio editor, adapted for Shadow DOM (plain CSS, no Tailwind).
 */

import { useState, useCallback, useRef, useEffect } from "react";
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

export interface ColorPickerProps {
  value: string; // hex color
  alpha?: number; // 0-100
  onChange: (hex: string) => void;
  onAlphaChange?: (alpha: number) => void;
  onClose: () => void;
  anchorRect: { top: number; left: number; width: number; height: number };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function ColorPicker({ value, alpha = 100, onChange, onAlphaChange, onClose, anchorRect }: ColorPickerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [hsva, setHsva] = useState<HSVA>(() => hexToHsva(value || "#000000"));
  const lastSentRef = useRef("");

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
  useEffect(() => {
    if (focusedRef.current) return;
    setHexInput(hsvToHex(hsva.h, hsva.s, hsva.v).replace("#", "").toUpperCase());
    const { r, g, b } = hsvToRgb(hsva.h, hsva.s, hsva.v);
    setRgbInputs({ r: String(r), g: String(g), b: String(b) });
  }, [hsva]);

  const emitChange = useCallback((newHsva: HSVA) => {
    setHsva(newHsva);
    const hex = hsvaToHex(newHsva);
    lastSentRef.current = hex;
    onChange(hex);
  }, [onChange]);

  // Close on outside click
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      const path = e.composedPath();
      if (!path.includes(panel)) {
        onClose();
      }
    };
    const root = panelRef.current?.getRootNode() as ShadowRoot | Document;
    // Delay to avoid the click that opened the picker
    const timer = setTimeout(() => {
      root.addEventListener("pointerdown", handlePointerDown as EventListener);
    }, 0);
    return () => {
      clearTimeout(timer);
      root.removeEventListener("pointerdown", handlePointerDown as EventListener);
    };
  }, [onClose]);

  // Position the panel
  const panelWidth = anchorRect.width;
  const panelEstimatedHeight = 320;
  const spaceBelow = window.innerHeight - anchorRect.top - anchorRect.height - 4;
  const flipUp = spaceBelow < panelEstimatedHeight && anchorRect.top > spaceBelow;
  const top = flipUp
    ? anchorRect.top - panelEstimatedHeight - 4
    : anchorRect.top + anchorRect.height + 4;
  const left = anchorRect.left;

  // ── SV Picker ───────────────────────────────────────────────────────

  const svRef = useRef<HTMLDivElement>(null);

  const getSV = useCallback((clientX: number, clientY: number) => {
    if (!svRef.current) return null;
    const rect = svRef.current.getBoundingClientRect();
    const s = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const v = clamp((1 - (clientY - rect.top) / rect.height) * 100, 0, 100);
    return { s, v };
  }, []);

  // Keep a ref to the latest hsva so drag handlers don't go stale
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
    };
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
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
    };
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  }, [getHue, emitChange]);

  // ── Alpha Slider ───────────────────────────────────────────────────

  const alphaRef = useRef<HTMLDivElement>(null);
  const [localAlpha, setLocalAlpha] = useState(alpha);
  const onAlphaChangeRef = useRef(onAlphaChange);
  onAlphaChangeRef.current = onAlphaChange;

  // Sync alpha from parent
  const [prevAlpha, setPrevAlpha] = useState(alpha);
  if (alpha !== prevAlpha) {
    setPrevAlpha(alpha);
    setLocalAlpha(alpha);
  }

  const getAlpha = useCallback((clientX: number) => {
    if (!alphaRef.current) return 100;
    const rect = alphaRef.current.getBoundingClientRect();
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
    };
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
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

  const handleKeyDown = useCallback(
    (commitFn: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
        commitFn();
      }
    },
    []
  );

  const currentHex = hsvToHex(hsva.h, hsva.s, hsva.v);
  const handleLeft = hsva.s;
  const handleTop = 100 - hsva.v;

  return (
    <div
      ref={panelRef}
      className="composer-color-picker-panel"
      style={{
        position: "fixed",
        top: Math.max(4, top),
        left: Math.max(4, left),
        width: panelWidth,
        zIndex: 10000,
      }}
    >
      {/* SV Picker */}
      <div
        ref={svRef}
        className="composer-cp-sv"
        style={{
          backgroundColor: `hsl(${hsva.h}, 100%, 50%)`,
        }}
        onPointerDown={handleSVPointerDown}
      >
        <div className="composer-cp-sv-white" />
        <div className="composer-cp-sv-black" />
        {/* Handle */}
        <div
          className="composer-cp-handle"
          style={{
            left: `${handleLeft}%`,
            top: `${handleTop}%`,
          }}
        >
          <div
            className="composer-cp-handle-inner"
            style={{ backgroundColor: currentHex }}
          />
        </div>
      </div>

      {/* Sliders */}
      <div className="composer-cp-sliders">
        {/* Color preview swatch */}
        <div className="composer-cp-preview-wrap">
          <div className="composer-cp-preview-checker" />
          <div
            className="composer-cp-preview"
            style={{ backgroundColor: localAlpha < 100
              ? `rgba(${hsvToRgb(hsva.h, hsva.s, hsva.v).r}, ${hsvToRgb(hsva.h, hsva.s, hsva.v).g}, ${hsvToRgb(hsva.h, hsva.s, hsva.v).b}, ${localAlpha / 100})`
              : currentHex
            }}
          />
        </div>
        <div className="composer-cp-slider-tracks">
          {/* Hue */}
          <div
            ref={hueRef}
            className="composer-cp-hue"
            onPointerDown={handleHuePointerDown}
          >
            <div
              className="composer-cp-handle"
              style={{
                left: `${(hsva.h / 360) * 100}%`,
                top: "50%",
              }}
            >
              <div
                className="composer-cp-handle-inner"
                style={{ backgroundColor: `hsl(${hsva.h}, 100%, 50%)` }}
              />
            </div>
          </div>
          {/* Alpha */}
          <div
            ref={alphaRef}
            className="composer-cp-alpha"
            onPointerDown={handleAlphaPointerDown}
          >
            <div className="composer-cp-alpha-checker" />
            <div
              className="composer-cp-alpha-gradient"
              style={{
                background: `linear-gradient(to right, transparent, ${currentHex})`,
              }}
            />
            <div
              className="composer-cp-handle"
              style={{
                left: `${localAlpha}%`,
                top: "50%",
              }}
            >
              <div
                className="composer-cp-handle-inner"
                style={{ backgroundColor: localAlpha < 100
                  ? `rgba(${hsvToRgb(hsva.h, hsva.s, hsva.v).r}, ${hsvToRgb(hsva.h, hsva.s, hsva.v).g}, ${hsvToRgb(hsva.h, hsva.s, hsva.v).b}, ${localAlpha / 100})`
                  : currentHex
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Inputs */}
      <div className="composer-cp-inputs">
        <div className="composer-cp-input-group">
          <label className="composer-cp-label">Hex</label>
          <input
            className="composer-cp-input"
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onFocus={() => { focusedRef.current = "hex"; }}
            onBlur={commitHex}
            onKeyDown={handleKeyDown(commitHex)}
            spellCheck={false}
          />
        </div>
        <div className="composer-cp-input-group">
          <label className="composer-cp-label">R</label>
          <input
            className="composer-cp-input"
            inputMode="numeric"
            value={rgbInputs.r}
            onChange={(e) => setRgbInputs(prev => ({ ...prev, r: e.target.value }))}
            onFocus={() => { focusedRef.current = "r"; }}
            onBlur={commitRgb}
            onKeyDown={handleKeyDown(commitRgb)}
          />
        </div>
        <div className="composer-cp-input-group">
          <label className="composer-cp-label">G</label>
          <input
            className="composer-cp-input"
            inputMode="numeric"
            value={rgbInputs.g}
            onChange={(e) => setRgbInputs(prev => ({ ...prev, g: e.target.value }))}
            onFocus={() => { focusedRef.current = "g"; }}
            onBlur={commitRgb}
            onKeyDown={handleKeyDown(commitRgb)}
          />
        </div>
        <div className="composer-cp-input-group">
          <label className="composer-cp-label">B</label>
          <input
            className="composer-cp-input"
            inputMode="numeric"
            value={rgbInputs.b}
            onChange={(e) => setRgbInputs(prev => ({ ...prev, b: e.target.value }))}
            onFocus={() => { focusedRef.current = "b"; }}
            onBlur={commitRgb}
            onKeyDown={handleKeyDown(commitRgb)}
          />
        </div>
      </div>
    </div>
  );
}

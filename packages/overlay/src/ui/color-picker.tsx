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
import { Tooltip } from "./tooltip";
import type { DesignVariable } from "../variables/types";
import { getVariablesForProperty } from "../variables/resolver";
import { getCategoryForProperty } from "../variables/categories";

/** Format variable name for display: strip var(-- ) → "color-brand" */
function formatVarName(className: string): string {
  if (className.startsWith("var(--") && className.endsWith(")")) {
    return className.slice(6, -1);
  }
  return className;
}

/** Strip CSS property prefix from class name: "bg-blue-500" → "blue-500" */
const PROPERTY_PREFIXES = ["bg-", "text-", "border-", "fill-", "stroke-", "outline-", "ring-"];
function stripPropertyPrefix(className: string): string {
  for (const prefix of PROPERTY_PREFIXES) {
    if (className.startsWith(prefix)) return className.slice(prefix.length);
  }
  return className;
}

/** Get display name for a variable/class token */
function getDisplayName(className: string): string {
  if (className.startsWith("var(--") && className.endsWith(")")) return className.slice(6, -1);
  return stripPropertyPrefix(className);
}

/** Extract ramp group + shade: "blue-500" → { group: "blue", shade: "500" } */
function extractColorGroup(name: string): { group: string; shade: string } {
  const m = name.match(/^(.+)-(\d+)$/);
  if (m) return { group: m[1], shade: m[2] };
  return { group: name, shade: "" };
}

/** Group variables by color ramp */
function groupByRamp(items: DesignVariable[]): Map<string, DesignVariable[]> {
  const groups = new Map<string, DesignVariable[]>();
  for (const t of items) {
    const displayName = getDisplayName(t.className);
    const { group } = extractColorGroup(displayName);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(t);
  }
  return groups;
}

export interface ColorPickerProps {
  value: string; // hex color
  alpha?: number; // 0-100
  onChange: (hex: string) => void;
  onAlphaChange?: (alpha: number) => void;
  onClose: () => void;
  anchorRect: { top: number; left: number; width: number; height: number };
  // Token integration
  property?: string;
  currentVariable?: DesignVariable;
  onVariableSelect?: (oldToken: DesignVariable, newToken: DesignVariable, properties?: string[]) => void;
  onVariableApply?: (variable: DesignVariable, properties: string[]) => void;
  onVariableUnlink?: () => void;
  initialTab?: "custom" | "tokens";
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Format a token value for display */
function formatTokenValue(variable: DesignVariable): string {
  const vals = Object.values(variable.values);
  if (vals.length === 0) return "";
  const val = vals[0];
  return val.length > 20 ? val.slice(0, 20) + "\u2026" : val;
}

/** Get a swatch color from a variable */
function getSwatchColor(variable: DesignVariable): string | null {
  for (const [prop, val] of Object.entries(variable.values)) {
    if (prop.includes("color") || prop === "background-color" || prop === "fill" || prop === "stroke") {
      return val;
    }
    const v = val.trim().toLowerCase();
    if (v.startsWith("#") || v.startsWith("rgb") || v.startsWith("hsl") || v.startsWith("oklch") || v.startsWith("oklab")) {
      return val;
    }
  }
  return null;
}

export function ColorPicker({
  value, alpha = 100, onChange, onAlphaChange, onClose, anchorRect,
  property, currentVariable, onVariableSelect, onVariableApply, onVariableUnlink, initialTab,
}: ColorPickerProps) {
  const [hsva, setHsva] = useState<HSVA>(() => hexToHsva(value || "#000000"));
  const lastSentRef = useRef("");
  const dragCleanupRef = useRef<(() => void) | null>(null);

  // ── Token tab support ─────────────────────────────────────────────
  const allVariables = useMemo(() => property ? getVariablesForProperty(property) : [], [property]);
  const category = property
    ? getCategoryForProperty(property.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`))
    : null;
  const hasVariables = allVariables.length > 0;

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

  const filteredVariables = useMemo(() => {
    if (!tokenSearch) return allVariables;
    const q = tokenSearch.toLowerCase();
    return allVariables.filter(t =>
      t.className.toLowerCase().includes(q) ||
      Object.values(t.values).some(v => v.toLowerCase().includes(q))
    );
  }, [allVariables, tokenSearch]);

  // Reset highlight when filtered list changes
  useEffect(() => { setHighlightedIndex(-1); }, [filteredVariables]);

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
  const onVariableSelectRef = useRef(onVariableSelect);
  onVariableSelectRef.current = onVariableSelect;
  const onVariableApplyRef = useRef(onVariableApply);
  onVariableApplyRef.current = onVariableApply;
  const currentVariableRef = useRef(currentVariable);
  currentVariableRef.current = currentVariable;
  const filteredVariablesRef = useRef(filteredVariables);
  filteredVariablesRef.current = filteredVariables;
  const propertyRef = useRef(property);
  propertyRef.current = property;

  // Keyboard nav for token search
  const handleTokenSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = filteredVariablesRef.current.length;
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
          const v = filteredVariablesRef.current[curr];
          if (v) {
            const props = propertyRef.current ? [propertyRef.current] : [];
            if (currentVariableRef.current) {
              onVariableSelectRef.current?.(currentVariableRef.current, v, props);
            } else {
              onVariableApplyRef.current?.(v, props);
            }
            onCloseRef.current();
          }
        }
        return curr;
      });
    }
  }, []);

  // Native click handler for token items — re-attach when tab changes
  // (the token list isn't mounted when the Custom tab is active)
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
      const v = filteredVariablesRef.current[idx];
      if (v) {
        const props = propertyRef.current ? [propertyRef.current] : [];
        if (currentVariableRef.current) {
          onVariableSelectRef.current?.(currentVariableRef.current, v, props);
        } else {
          onVariableApplyRef.current?.(v, props);
        }
        onCloseRef.current();
      }
    };
    list.addEventListener("pointerdown", handleClick);
    return () => list.removeEventListener("pointerdown", handleClick);
  }, [activeTab]);

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

  const categoryLabel = "Variables";

  const handleHeaderAction = useCallback((action: string) => {
    if (action === "unlink") {
      onVariableUnlink?.();
      onClose();
    }
  }, [onVariableUnlink, onClose]);

  const isUnlinkDisabled = !currentVariable;

  const unlinkButton = (
    <Tooltip content={currentVariable ? "Unlink variable" : "No variable linked"} side="bottom" delay={300}>
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

  const rampGroups = useMemo(() => groupByRamp(filteredVariables), [filteredVariables]);

  // Separate ramps (2+ items) from standalone items, sort alphabetically
  const { ramps, standalone } = useMemo(() => {
    const ramps: [string, DesignVariable[]][] = [];
    const standalone: DesignVariable[] = [];
    for (const [name, items] of rampGroups) {
      if (items.length > 1) {
        items.sort((a, b) => {
          const aShade = parseInt(extractColorGroup(getDisplayName(a.className)).shade) || 0;
          const bShade = parseInt(extractColorGroup(getDisplayName(b.className)).shade) || 0;
          return aShade - bShade;
        });
        ramps.push([name, items]);
      }
      else standalone.push(...items);
    }
    standalone.sort((a, b) => getDisplayName(a.className).localeCompare(getDisplayName(b.className)));
    ramps.sort((a, b) => a[0].localeCompare(b[0]));
    return { ramps, standalone };
  }, [rampGroups]);

  const tokenContent = (() => {
    let globalIndex = 0;

    const renderItem = (v: DesignVariable) => {
      const idx = globalIndex++;
      const isActive = currentVariable?.className === v.className;
      const isHighlighted = idx === highlightedIndex;
      return (
        <div
          key={v.className}
          className={`retune-variable-dialog-item${isActive ? " retune-variable-dialog-item-active" : ""}${isHighlighted ? " retune-variable-dialog-item-highlighted" : ""}`}
          data-token-index={idx}
        >
          <span
            className="retune-variable-dialog-swatch"
            style={{ backgroundColor: getSwatchColor(v) || "transparent" }}
          />
          <span className="retune-variable-dialog-name">{getDisplayName(v.className)}</span>
        </div>
      );
    };

    return (
      <div ref={tokenListRef} className="retune-variable-dialog-list">
        {filteredVariables.length === 0 && (
          <div className="retune-variable-dialog-empty">No variables found</div>
        )}
        {/* Standalone items first (no group header) */}
        {standalone.map(renderItem)}
        {/* Ramp groups with headers */}
        {ramps.map(([groupName, items]) => (
          <div key={groupName}>
            <div className="retune-variable-dialog-group-title">
              {groupName.replace(/-/g, " ")}
            </div>
            {items.map(renderItem)}
          </div>
        ))}
      </div>
    );
  })();

  if (hasVariables) {
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
        headerActions={unlinkButton}
        onHeaderAction={handleHeaderAction}
        minHeight={activeTab === "custom" ? undefined : 400}
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

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  type HSVA,
  type ColorMode,
  hsvToRgb,
  rgbToHsv,
  hsvToHsl,
  hslToHsv,
  hsvToHex,
  hexToHsva,
} from "./color-utils";
import { Dropdown, type DropdownOption } from "../ui/dropdown";

interface ColorModeInputsProps {
  hsva: HSVA;
  onChange: (hsva: HSVA) => void;
  mode: ColorMode;
  onModeChange: (mode: ColorMode) => void;
}

const inputClassName =
  "text-[11px] font-medium tracking-[0.055px] w-full h-6 bg-transparent border-0 pl-1.5 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-stone-900 dark:text-stone-100";

const cellClassName =
  "flex flex-1 h-full items-center min-w-0 border-r border-stone-200 dark:border-stone-700";

const MODE_OPTIONS: DropdownOption[] = [
  { value: "Hex", label: "Hex" },
  { value: "RGB", label: "RGB" },
  { value: "HSL", label: "HSL" },
  { value: "HSB", label: "HSB" },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getHexFromHsva(hsva: HSVA): string {
  return hsvToHex(hsva.h, hsva.s, hsva.v).replace("#", "").toUpperCase();
}

function getRgbFromHsva(hsva: HSVA): { r: number; g: number; b: number } {
  const { r, g, b } = hsvToRgb(hsva.h, hsva.s, hsva.v);
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}

function getHslFromHsva(hsva: HSVA): { h: number; s: number; l: number } {
  const { h, s, l } = hsvToHsl(hsva.h, hsva.s, hsva.v);
  return { h: Math.round(h), s: Math.round(s), l: Math.round(l) };
}

function getHsbFromHsva(hsva: HSVA): { h: number; s: number; b: number } {
  return {
    h: Math.round(hsva.h),
    s: Math.round(hsva.s),
    b: Math.round(hsva.v),
  };
}

const ColorModeInputs = React.memo(function ColorModeInputs({
  hsva,
  onChange,
  mode,
  onModeChange,
}: ColorModeInputsProps) {

  // Local string state for each input to allow free typing
  const [hexValue, setHexValue] = useState(() => getHexFromHsva(hsva));
  const [rgbValues, setRgbValues] = useState(() => {
    const { r, g, b } = getRgbFromHsva(hsva);
    return { r: String(r), g: String(g), b: String(b) };
  });
  const [hslValues, setHslValues] = useState(() => {
    const { h, s, l } = getHslFromHsva(hsva);
    return { h: String(h), s: String(s), l: String(l) };
  });
  const [hsbValues, setHsbValues] = useState(() => {
    const { h, s, b } = getHsbFromHsva(hsva);
    return { h: String(h), s: String(s), b: String(b) };
  });
  const [opacityValue, setOpacityValue] = useState(() =>
    String(Math.round(hsva.a)),
  );

  // Track whether an input is currently focused to avoid overwriting user input
  const focusedRef = useRef<string | null>(null);

  // Sync local state from props when hsva changes externally
  useEffect(() => {
    if (focusedRef.current) return;

    setHexValue(getHexFromHsva(hsva));

    const rgb = getRgbFromHsva(hsva);
    setRgbValues({ r: String(rgb.r), g: String(rgb.g), b: String(rgb.b) });

    const hsl = getHslFromHsva(hsva);
    setHslValues({ h: String(hsl.h), s: String(hsl.s), l: String(hsl.l) });

    const hsb = getHsbFromHsva(hsva);
    setHsbValues({ h: String(hsb.h), s: String(hsb.s), b: String(hsb.b) });

    setOpacityValue(String(Math.round(hsva.a)));
  }, [hsva]);

  // Recalculate displayed values on mode switch
  const handleModeChange = useCallback(
    (newMode: ColorMode) => {
      onModeChange(newMode);

      setHexValue(getHexFromHsva(hsva));

      const rgb = getRgbFromHsva(hsva);
      setRgbValues({ r: String(rgb.r), g: String(rgb.g), b: String(rgb.b) });

      const hsl = getHslFromHsva(hsva);
      setHslValues({ h: String(hsl.h), s: String(hsl.s), l: String(hsl.l) });

      const hsb = getHsbFromHsva(hsva);
      setHsbValues({ h: String(hsb.h), s: String(hsb.s), b: String(hsb.b) });

      setOpacityValue(String(Math.round(hsva.a)));
    },
    [hsva, onModeChange],
  );

  // -- Hex commit --
  const commitHex = useCallback(() => {
    focusedRef.current = null;
    let cleaned = hexValue.replace(/^#/, "").trim();
    if (cleaned.length === 3) {
      cleaned =
        cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2];
    }
    if (/^[a-fA-F0-9]{6}$/.test(cleaned)) {
      const newHsva = hexToHsva(`#${cleaned}`, hsva.a);
      onChange(newHsva);
      setHexValue(cleaned.toUpperCase());
    } else {
      // revert to current value
      setHexValue(getHexFromHsva(hsva));
    }
  }, [hexValue, hsva, onChange]);

  // -- RGB commit --
  const commitRgb = useCallback(() => {
    focusedRef.current = null;
    const r = clamp(Math.round(Number(rgbValues.r) || 0), 0, 255);
    const g = clamp(Math.round(Number(rgbValues.g) || 0), 0, 255);
    const b = clamp(Math.round(Number(rgbValues.b) || 0), 0, 255);
    const { h, s, v } = rgbToHsv(r, g, b);
    onChange({ h, s, v, a: hsva.a });
    setRgbValues({ r: String(r), g: String(g), b: String(b) });
  }, [rgbValues, hsva.a, onChange]);

  // -- HSL commit --
  const commitHsl = useCallback(() => {
    focusedRef.current = null;
    const h = clamp(Math.round(Number(hslValues.h) || 0), 0, 360);
    const s = clamp(Math.round(Number(hslValues.s) || 0), 0, 100);
    const l = clamp(Math.round(Number(hslValues.l) || 0), 0, 100);
    const hsv = hslToHsv(h, s, l);
    onChange({ h: hsv.h, s: hsv.s, v: hsv.v, a: hsva.a });
    setHslValues({ h: String(h), s: String(s), l: String(l) });
  }, [hslValues, hsva.a, onChange]);

  // -- HSB commit --
  const commitHsb = useCallback(() => {
    focusedRef.current = null;
    const h = clamp(Math.round(Number(hsbValues.h) || 0), 0, 360);
    const s = clamp(Math.round(Number(hsbValues.s) || 0), 0, 100);
    const b = clamp(Math.round(Number(hsbValues.b) || 0), 0, 100);
    onChange({ h, s, v: b, a: hsva.a });
    setHsbValues({ h: String(h), s: String(s), b: String(b) });
  }, [hsbValues, hsva.a, onChange]);

  // -- Opacity commit --
  const commitOpacity = useCallback(() => {
    focusedRef.current = null;
    const a = clamp(Math.round(Number(opacityValue) || 0), 0, 100);
    onChange({ ...hsva, a });
    setOpacityValue(String(a));
  }, [opacityValue, hsva, onChange]);

  // Key handler factory (Enter to commit)
  const handleKeyDown = useCallback(
    (commitFn: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
        commitFn();
      }
    },
    [],
  );

  // Opacity key handler (Enter + ArrowUp/ArrowDown)
  const handleOpacityKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
        commitOpacity();
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const current = Math.round(Number(e.currentTarget.value) || 0);
        const step = e.shiftKey ? 10 : 1;
        const delta = e.key === "ArrowUp" ? step : -step;
        const newVal = clamp(current + delta, 0, 100);
        e.currentTarget.value = String(newVal);
        setOpacityValue(String(newVal));
        onChange({ ...hsva, a: newVal });
      }
    },
    [hsva, onChange, commitOpacity],
  );

  // Derived hex for swatch display
  // -- Render inputs by mode --

  const renderHexInputs = () => (
    <div className="flex items-center flex-1 min-w-0 h-6 rounded bg-stone-100 dark:bg-stone-800">
      <div className={cellClassName}>
        <input
          type="text"
          value={hexValue}
          onChange={(e) => setHexValue(e.target.value)}
          onFocus={() => { focusedRef.current = "hex"; }}
          onBlur={commitHex}
          onKeyDown={handleKeyDown(commitHex)}
          className="text-[11px] font-medium tracking-[0.055px] flex-1 min-w-0 h-6 pl-1.5 bg-transparent border-0 focus:outline-none text-stone-900 dark:text-stone-100"
          spellCheck={false}
        />
      </div>
      <div className="flex items-center gap-1 px-1.5 shrink-0">
        <input
          type="text"
          inputMode="numeric"
          value={opacityValue}
          onChange={(e) => setOpacityValue(e.target.value)}
          onFocus={() => { focusedRef.current = "hex-opacity"; }}
          onBlur={commitOpacity}
          onKeyDown={handleOpacityKeyDown}
          className="w-6 h-6 text-[11px] text-center font-medium tracking-[0.055px] bg-transparent border-0 focus-visible:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-stone-900 dark:text-stone-100"
          aria-label="Opacity"
        />
        <span className="w-[11px] text-[11px] font-medium tracking-[0.055px] text-stone-500 dark:text-stone-400">%</span>
      </div>
    </div>
  );

  const renderThreeChannelInputs = (
    labels: [string, string, string],
    values: { a: string; b: string; c: string },
    setValues: (a: string, b: string, c: string) => void,
    commitFn: () => void,
    focusKey: string,
  ) => (
    <div className="flex items-center flex-1 min-w-0 h-6 rounded bg-stone-100 dark:bg-stone-800">
      {/* Channel 1 */}
      <div className={cellClassName}>
        <input
          type="text"
          inputMode="numeric"
          value={values.a}
          onChange={(e) => setValues(e.target.value, values.b, values.c)}
          onFocus={() => { focusedRef.current = `${focusKey}-a`; }}
          onBlur={commitFn}
          onKeyDown={handleKeyDown(commitFn)}
          className={inputClassName}
          aria-label={labels[0]}
        />
      </div>
      {/* Channel 2 */}
      <div className={cellClassName}>
        <input
          type="text"
          inputMode="numeric"
          value={values.b}
          onChange={(e) => setValues(values.a, e.target.value, values.c)}
          onFocus={() => { focusedRef.current = `${focusKey}-b`; }}
          onBlur={commitFn}
          onKeyDown={handleKeyDown(commitFn)}
          className={inputClassName}
          aria-label={labels[1]}
        />
      </div>
      {/* Channel 3 */}
      <div className={cellClassName}>
        <input
          type="text"
          inputMode="numeric"
          value={values.c}
          onChange={(e) => setValues(values.a, values.b, e.target.value)}
          onFocus={() => { focusedRef.current = `${focusKey}-c`; }}
          onBlur={commitFn}
          onKeyDown={handleKeyDown(commitFn)}
          className={inputClassName}
          aria-label={labels[2]}
        />
      </div>
      {/* Opacity */}
      <div className="flex items-center gap-1 px-1.5 shrink-0">
        <input
          type="text"
          inputMode="numeric"
          value={opacityValue}
          onChange={(e) => setOpacityValue(e.target.value)}
          onFocus={() => { focusedRef.current = `${focusKey}-opacity`; }}
          onBlur={commitOpacity}
          onKeyDown={handleOpacityKeyDown}
          className="w-6 h-6 text-[11px] text-center font-medium tracking-[0.055px] bg-transparent border-0 focus-visible:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-stone-900 dark:text-stone-100"
          aria-label="Opacity"
        />
        <span className="w-[11px] text-[11px] font-medium tracking-[0.055px] text-stone-500 dark:text-stone-400">%</span>
      </div>
    </div>
  );

  const renderValueInputs = () => {
    switch (mode) {
      case "Hex":
        return renderHexInputs();
      case "RGB":
        return renderThreeChannelInputs(
          ["R", "G", "B"],
          { a: rgbValues.r, b: rgbValues.g, c: rgbValues.b },
          (r, g, b) => setRgbValues({ r, g, b }),
          commitRgb,
          "rgb",
        );
      case "HSL":
        return renderThreeChannelInputs(
          ["H", "S", "L"],
          { a: hslValues.h, b: hslValues.s, c: hslValues.l },
          (h, s, l) => setHslValues({ h, s, l }),
          commitHsl,
          "hsl",
        );
      case "HSB":
        return renderThreeChannelInputs(
          ["H", "S", "B"],
          { a: hsbValues.h, b: hsbValues.s, c: hsbValues.b },
          (h, s, b) => setHsbValues({ h, s, b }),
          commitHsb,
          "hsb",
        );
    }
  };

  return (
    <div className="flex flex-row gap-2">
      {/* Mode dropdown */}
      <Dropdown
        value={mode}
        onValueChange={(v) => handleModeChange(v as ColorMode)}
        options={MODE_OPTIONS}
        className="min-w-0 w-[53px] dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700"
        menuWidth="auto"
      />

      {/* Value inputs */}
      {renderValueInputs()}
    </div>
  );
});

export default ColorModeInputs;

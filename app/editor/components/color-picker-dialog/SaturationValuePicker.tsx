"use client";

import React, { useCallback, useRef, useLayoutEffect } from "react";
import { type ColorMode, hsvToHex, hsvToHsl, hslToHsv, hslToRgb } from "./color-utils";

const ARROW_STEP = 1;

interface SaturationValuePickerProps {
  hue: number; // 0-360
  saturation: number; // 0-100
  value: number; // 0-100
  onChange: (s: number, v: number) => void;
  mode?: ColorMode;
}

export const SaturationValuePicker = React.memo(
  function SaturationValuePicker({
    hue,
    saturation,
    value,
    onChange,
    mode = "Hex",
  }: SaturationValuePickerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    // Refs for values needed in stale closures (getSV captured at pointer-down)
    const hueRef = useRef(hue);
    hueRef.current = hue;
    const modeRef = useRef(mode);
    modeRef.current = mode;

    const isHslMode = mode === "HSL";

    // ── Handle positioning ─────────────────────────────────────────────
    let handleLeft: number;
    let handleTop: number;

    if (isHslMode) {
      const hsl = hsvToHsl(hue, saturation, value);
      handleLeft = hsl.s;
      handleTop = 100 - hsl.l;
    } else {
      handleLeft = saturation;
      handleTop = 100 - value;
    }

    // ── ARIA ───────────────────────────────────────────────────────────
    const ariaValueText = isHslMode
      ? `Saturation ${Math.round(hsvToHsl(hue, saturation, value).s)}%, Lightness ${Math.round(hsvToHsl(hue, saturation, value).l)}%`
      : `Saturation ${Math.round(saturation)}%, Brightness ${Math.round(value)}%`;

    // ── Canvas rendering for HSL mode ──────────────────────────────────
    useLayoutEffect(() => {
      if (!isHslMode || !canvasRef.current || !containerRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const logicalWidth = containerRef.current.clientWidth;
      const logicalHeight = containerRef.current.clientHeight;
      if (logicalWidth === 0 || logicalHeight === 0) return;

      // Cap at 1x to reduce pixel work — the smooth gradient hides any quality loss
      const w = logicalWidth;
      const h = logicalHeight;

      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${logicalWidth}px`;
      canvas.style.height = `${logicalHeight}px`;

      const imageData = ctx.createImageData(w, h);
      const data = imageData.data;

      for (let y = 0; y < h; y++) {
        const l = (1 - y / (h - 1)) * 100; // top = 100%, bottom = 0%
        for (let x = 0; x < w; x++) {
          const s = (x / (w - 1)) * 100; // left = 0%, right = 100%
          const { r, g, b } = hslToRgb(hue, s, l);
          const idx = (y * w + x) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);
    }, [hue, isHslMode]);

    // ── Keyboard navigation ────────────────────────────────────────────
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        const step = e.shiftKey ? ARROW_STEP * 10 : ARROW_STEP;
        const currentMode = modeRef.current;
        const currentHue = hueRef.current;

        if (currentMode === "HSL") {
          const hsl = hsvToHsl(currentHue, saturation, value);
          let hslS = hsl.s;
          let hslL = hsl.l;
          switch (e.key) {
            case "ArrowRight": hslS = Math.min(100, hslS + step); break;
            case "ArrowLeft":  hslS = Math.max(0, hslS - step); break;
            case "ArrowUp":    hslL = Math.min(100, hslL + step); break;
            case "ArrowDown":  hslL = Math.max(0, hslL - step); break;
            default: return;
          }
          e.preventDefault();
          const hsv = hslToHsv(currentHue, hslS, hslL);
          onChangeRef.current(hsv.s, hsv.v);
        } else {
          let s = saturation;
          let v = value;
          switch (e.key) {
            case "ArrowRight": s = Math.min(100, s + step); break;
            case "ArrowLeft":  s = Math.max(0, s - step); break;
            case "ArrowUp":    v = Math.min(100, v + step); break;
            case "ArrowDown":  v = Math.max(0, v - step); break;
            default: return;
          }
          e.preventDefault();
          onChangeRef.current(s, v);
        }
      },
      [saturation, value]
    );

    // ── Pointer → SV conversion ────────────────────────────────────────
    const getSV = useCallback(
      (clientX: number, clientY: number) => {
        if (!containerRef.current) return null;
        const rect = containerRef.current.getBoundingClientRect();
        const xNorm = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const yNorm = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

        if (modeRef.current === "HSL") {
          const hslS = xNorm * 100;
          const hslL = (1 - yNorm) * 100;
          const hsv = hslToHsv(hueRef.current, hslS, hslL);
          return { s: hsv.s, v: hsv.v };
        }

        return { s: xNorm * 100, v: (1 - yNorm) * 100 };
      },
      []
    );

    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        const result = getSV(e.clientX, e.clientY);
        if (result) onChangeRef.current(result.s, result.v);

        const handleMove = (me: PointerEvent) => {
          const r = getSV(me.clientX, me.clientY);
          if (!r) return;
          onChangeRef.current(r.s, r.v);
        };

        const handleUp = (me: PointerEvent) => {
          (me.target as HTMLElement).releasePointerCapture(me.pointerId);
          document.removeEventListener("pointermove", handleMove);
          document.removeEventListener("pointerup", handleUp);
        };

        document.addEventListener("pointermove", handleMove);
        document.addEventListener("pointerup", handleUp);
      },
      [getSV]
    );

    return (
      <div
        ref={containerRef}
        role="application"
        aria-label="Color picker"
        aria-roledescription="2D color picker"
        aria-valuetext={ariaValueText}
        tabIndex={0}
        className="relative w-full aspect-square rounded-input focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
      >
        {/* Gradient area — overflow-hidden clips gradients to rounded corners */}
        <div
          className="absolute inset-0 rounded-input overflow-hidden"
          style={{
            backgroundColor: `hsl(${hue}, 100%, 50%)`,
            backgroundImage: `linear-gradient(to right, #fff, transparent), linear-gradient(to bottom, transparent, #000)`,
            boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.1)",
          }}
        >
          {isHslMode && (
            <canvas
              ref={canvasRef}
              className="absolute inset-0"
              style={{ pointerEvents: "none" }}
            />
          )}
        </div>
        {/* Handle — outside overflow-hidden so it's not clipped at edges */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${handleLeft}%`,
            top: `${handleTop}%`,
            transform: "translate(-50%, -50%)",
            willChange: "transform",
          }}
        >
          <div
            className="rounded-full"
            style={{
              width: 16,
              height: 16,
              border: "4px solid white",
              boxShadow:
                "0 0 0.5px rgba(0,0,0,0.18), 0 3px 8px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <div
              className="w-full h-full rounded-full"
              style={{
                backgroundColor: hsvToHex(hue, saturation, value),
              }}
            />
          </div>
        </div>
      </div>
    );
  }
);

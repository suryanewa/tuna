"use client";

import React, { useCallback, useRef } from "react";

const ARROW_STEP = 1;

interface ColorSliderProps {
  value: number;
  max: number;
  onChange: (value: number) => void;
  gradient: string;
  checkerboard?: boolean;
  ariaLabel?: string;
  handleColor?: string;
}

const ColorSlider = React.memo(function ColorSlider({
  value,
  max,
  onChange,
  gradient,
  checkerboard,
  ariaLabel,
  handleColor,
}: ColorSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? ARROW_STEP * 10 : ARROW_STEP;
      let next = value;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":    next = Math.min(max, value + step); break;
        case "ArrowLeft":
        case "ArrowDown":  next = Math.max(0, value - step); break;
        default: return;
      }
      e.preventDefault();
      onChangeRef.current(next);
    },
    [value, max]
  );

  const getValue = useCallback(
    (clientX: number) => {
      const rect = trackRef.current!.getBoundingClientRect();
      return Math.max(0, Math.min(max, ((clientX - rect.left) / rect.width) * max));
    },
    [max]
  );

  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<number | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      onChangeRef.current(getValue(e.clientX));

      const handleMove = (me: PointerEvent) => {
        pendingRef.current = getValue(me.clientX);
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            if (pendingRef.current !== null) {
              onChangeRef.current(pendingRef.current);
              pendingRef.current = null;
            }
          });
        }
      };

      const handleUp = () => {
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup", handleUp);
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        if (pendingRef.current !== null) {
          onChangeRef.current(pendingRef.current);
          pendingRef.current = null;
        }
      };

      document.addEventListener("pointermove", handleMove);
      document.addEventListener("pointerup", handleUp);
    },
    [getValue]
  );

  const leftPercent = (value / max) * 100;

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label={ariaLabel}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-orientation="horizontal"
      tabIndex={0}
      className="relative h-4 w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-full"
      style={{ touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    >
      {/* Track with clipped gradient */}
      <div className="absolute inset-0 overflow-hidden rounded-full border border-black/10">
        {checkerboard && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)",
              backgroundSize: "6px 6px",
              backgroundPosition: "0 0, 3px 3px",
            }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{ backgroundImage: gradient }}
        />
      </div>
      {/* Handle - outside overflow-hidden so it's never clipped */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: `${leftPercent}%`,
          top: "50%",
          transform: "translate(-50%, -50%)",
          willChange: "transform",
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            border: "4px solid white",
            boxShadow:
              "0 0 0.5px rgba(0,0,0,0.18), 0 3px 8px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              backgroundColor: handleColor ?? "white",
            }}
          />
        </div>
      </div>
    </div>
  );
});

export default ColorSlider;

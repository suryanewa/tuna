"use client";

import React, { useCallback, useRef, useEffect } from "react";
import type { GradientStop } from "../ui/color-input";
import { hexToRgb, rgbToHex } from "./color-utils";

interface GradientStopBarProps {
  stops: GradientStop[];
  selectedIndex: number;
  onSelectStop: (index: number) => void;
  onStopPositionChange: (index: number, position: number) => void;
  onAddStop: (position: number, color: string) => void;
  gradientCss: string;
}

const CHECKERBOARD_CSS = {
  backgroundImage:
    "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)",
  backgroundSize: "6px 6px",
  backgroundPosition: "0 0, 3px 3px",
} as const;

function interpolateColor(stops: GradientStop[], position: number): string {
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  let left = sorted[0];
  let right = sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].position <= position && sorted[i + 1].position >= position) {
      left = sorted[i];
      right = sorted[i + 1];
      break;
    }
  }
  const range = right.position - left.position;
  const t = range === 0 ? 0 : (position - left.position) / range;
  const lRgb = hexToRgb(left.color);
  const rRgb = hexToRgb(right.color);
  return rgbToHex(
    Math.round(lRgb.r + (rRgb.r - lRgb.r) * t),
    Math.round(lRgb.g + (rRgb.g - lRgb.g) * t),
    Math.round(lRgb.b + (rRgb.b - lRgb.b) * t),
  );
}

export const GradientStopBar = React.memo(function GradientStopBar({
  stops,
  selectedIndex,
  onSelectStop,
  onStopPositionChange,
  onAddStop,
  gradientCss,
}: GradientStopBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const draggingIndexRef = useRef<number | null>(null);

  // Keep callback refs current to avoid stale closures in document listeners
  const onStopPositionChangeRef = useRef(onStopPositionChange);
  onStopPositionChangeRef.current = onStopPositionChange;

  const getPosition = useCallback((clientX: number) => {
    const rect = barRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  // Document-level move/up handlers for drag (avoids pointer capture issues with React)
  useEffect(() => {
    const handleDocMove = (e: PointerEvent) => {
      if (draggingIndexRef.current === null) return;
      const position = getPosition(e.clientX);
      onStopPositionChangeRef.current(draggingIndexRef.current, position);
    };

    const handleDocUp = (e: PointerEvent) => {
      if (draggingIndexRef.current === null) return;
      const position = getPosition(e.clientX);
      onStopPositionChangeRef.current(draggingIndexRef.current, position);
      isDraggingRef.current = false;
      draggingIndexRef.current = null;
    };

    document.addEventListener("pointermove", handleDocMove);
    document.addEventListener("pointerup", handleDocUp);
    return () => {
      document.removeEventListener("pointermove", handleDocMove);
      document.removeEventListener("pointerup", handleDocUp);
    };
  }, [getPosition]);

  const handleHandlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, index: number) => {
      e.stopPropagation();
      e.preventDefault();
      isDraggingRef.current = true;
      draggingIndexRef.current = index;
      onSelectStop(index);
    },
    [onSelectStop],
  );

  const handleBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDraggingRef.current) return;
      const rect = barRef.current!.getBoundingClientRect();
      const position = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      const color = interpolateColor(stops, position);
      onAddStop(position, color);
    },
    [stops, onAddStop],
  );

  return (
    <div
      className="relative w-full"
      style={{ height: 48 }}
      onClick={handleBarClick}
    >
      {/* Gradient bar - 32px tall at the bottom */}
      <div
        ref={barRef}
        className="absolute bottom-0 left-0 right-0 overflow-hidden rounded-input"
        style={{ height: 32, border: "1px solid rgba(0,0,0,0.1)" }}
      >
        {/* Checkerboard background */}
        <div className="absolute inset-0" style={CHECKERBOARD_CSS} />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ backgroundImage: gradientCss }}
        />
      </div>

      {/* Stop indicators - positioned above and overlapping the bar */}
      {stops.map((stop, index) => (
        <div
          key={index}
          className="absolute cursor-grab active:cursor-grabbing"
          style={{
            left: `${stop.position * 100}%`,
            top: 0,
            transform: "translateX(-50%)",
            touchAction: "none",
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => handleHandlePointerDown(e, index)}
        >
          {/* Indicator container with shadow */}
          <div
            className="flex flex-col items-center"
            style={{ filter: `drop-shadow(0 0 0.5px rgba(0,0,0,0.18)) drop-shadow(0 3px 8px rgba(0,0,0,0.1)) drop-shadow(0 1px 3px rgba(0,0,0,0.1))` }}
          >
            {/* Color chit - 24x24 container with 14x14 color square */}
            <div
              className="flex items-center justify-center"
              style={{
                width: 24,
                height: 24,
                borderRadius: 5,
                backgroundColor: selectedIndex === index ? "#0d99ff" : "white",
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 2,
                  backgroundColor: stop.color,
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
                }}
              />
            </div>
            {/* Downward caret */}
            <div
              style={{
                width: 12,
                height: 6,
                clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                backgroundColor: selectedIndex === index ? "#0d99ff" : "white",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
});

/**
 * GradientStopBar — interactive gradient bar with draggable color stops.
 *
 * - Displays the gradient as a horizontal bar
 * - Stop indicators sit above the bar with carets pointing down
 * - Drag stops to reposition, click bar to add a new stop
 * - Selected stop indicator is highlighted blue
 */

import { useCallback, useRef } from "react";
import type { GradientStop } from "./gradient-utils";
import { interpolateColor } from "./gradient-utils";

export interface GradientStopBarProps {
  stops: GradientStop[];
  selectedIndex: number;
  onSelectStop: (index: number) => void;
  onStopPositionChange: (index: number, position: number) => void;
  onAddStop: (position: number, color: string) => void;
  gradientCss: string;
}

export function GradientStopBar({
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
  const stopsRef = useRef(stops);
  stopsRef.current = stops;
  const onStopPositionChangeRef = useRef(onStopPositionChange);
  onStopPositionChangeRef.current = onStopPositionChange;
  const onSelectStopRef = useRef(onSelectStop);
  onSelectStopRef.current = onSelectStop;

  const getPosition = useCallback((clientX: number) => {
    const rect = barRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  // Find which stop handle is closest to a click position
  const findClosestStop = useCallback((clientX: number) => {
    const pos = getPosition(clientX);
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < stopsRef.current.length; i++) {
      const dist = Math.abs(stopsRef.current[i].position - pos);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    // Only grab if within ~20px of a handle
    const rect = barRef.current!.getBoundingClientRect();
    const pxDist = minDist * rect.width;
    return pxDist < 20 ? closest : null;
  }, [getPosition]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const index = findClosestStop(e.clientX);
      if (index === null) return; // Will fall through to click handler for adding
      e.stopPropagation();
      e.preventDefault();
      isDraggingRef.current = true;
      draggingIndexRef.current = index;
      onSelectStopRef.current(index);

      const handleMove = (me: PointerEvent) => {
        if (draggingIndexRef.current === null) return;
        onStopPositionChangeRef.current(draggingIndexRef.current, getPosition(me.clientX));
      };
      const handleUp = () => {
        isDraggingRef.current = false;
        draggingIndexRef.current = null;
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup", handleUp);
      };
      document.addEventListener("pointermove", handleMove);
      document.addEventListener("pointerup", handleUp);
    },
    [findClosestStop, getPosition],
  );

  const handleBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDraggingRef.current) return;
      // Only add a stop if not clicking near an existing one
      const index = findClosestStop(e.clientX);
      if (index !== null) return;
      const position = getPosition(e.clientX);
      const color = interpolateColor(stops, position);
      onAddStop(position, color);
    },
    [stops, onAddStop, getPosition, findClosestStop],
  );

  return (
    <div
      className="composer-gradient-bar-wrap"
      onClick={handleBarClick}
      onPointerDown={handlePointerDown}
    >
      {/* Gradient bar */}
      <div ref={barRef} className="composer-gradient-bar">
        {/* Checkerboard */}
        <div className="composer-gradient-bar-checker" />
        {/* Gradient overlay */}
        <div className="composer-gradient-bar-fill" style={{ backgroundImage: gradientCss }} />
      </div>

      {/* Stop indicators (visual only — pointer events handled by wrapper) */}
      {stops.map((stop, index) => (
        <div
          key={index}
          className="composer-gradient-stop-handle"
          style={{ left: `${stop.position * 100}%`, pointerEvents: "none" }}
        >
          <div className="composer-gradient-stop-indicator">
            <div
              className="composer-gradient-stop-chit"
              style={{
                backgroundColor: selectedIndex === index ? "#0d99ff" : "white",
              }}
            >
              <div
                className="composer-gradient-stop-chit-color"
                style={{ backgroundColor: stop.color }}
              />
            </div>
            <div
              className="composer-gradient-stop-caret"
              style={{
                backgroundColor: selectedIndex === index ? "#0d99ff" : "white",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

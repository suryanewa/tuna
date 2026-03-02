"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface LabelSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  formatValue?: (value: number) => string;
  className?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Compute "nice" indicator positions along the track (targeting ~7 interior marks). */
function computeIndicators(min: number, max: number): number[] {
  const range = max - min;
  if (range <= 0) return [];

  const rawInterval = range / 8;
  const mag = Math.pow(10, Math.floor(Math.log10(rawInterval)));
  const normalized = rawInterval / mag;
  const nice = normalized < 1.5 ? 1 : normalized < 3.5 ? 2 : normalized < 7.5 ? 5 : 10;
  const interval = nice * mag;

  const positions: number[] = [];
  let v = Math.ceil(min / interval) * interval;
  while (v <= max + interval * 0.001) {
    const frac = (v - min) / range;
    if (frac > 0.03 && frac < 0.97) {
      positions.push(frac);
    }
    v = +(v + interval).toFixed(10);
  }
  return positions;
}

function defaultFormat(value: number, step: number): string {
  if (step >= 1) return String(Math.round(value));
  const decimals = Math.max(0, Math.min(4, -Math.floor(Math.log10(step))));
  return value.toFixed(decimals);
}

// ─── Component ──────────────────────────────────────────────────────────────

export function LabelSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.01,
  formatValue,
  className,
}: LabelSliderProps) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);

  const range = max - min;
  const fillPercent = range > 0 ? Math.max(0, Math.min(1, (value - min) / range)) * 100 : 0;

  const indicators = React.useMemo(() => computeIndicators(min, max), [min, max]);

  const displayValue = formatValue ? formatValue(value) : defaultFormat(value, step);

  const computeValue = React.useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return value;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      let raw = min + ratio * range;
      raw = Math.round(raw / step) * step;
      raw = Math.max(min, Math.min(max, raw));
      const precision = step < 1 ? Math.max(0, -Math.floor(Math.log10(step))) : 0;
      return Number(raw.toFixed(precision));
    },
    [min, max, range, step, value],
  );

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setIsDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      onChange(computeValue(e.clientX));
    },
    [onChange, computeValue],
  );

  const handlePointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      onChange(computeValue(e.clientX));
    },
    [isDragging, onChange, computeValue],
  );

  const handlePointerUp = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      const precision = step < 1 ? Math.max(0, -Math.floor(Math.log10(step))) : 0;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        onChange(Number(Math.max(min, value - step).toFixed(precision)));
      } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        onChange(Number(Math.min(max, value + step).toFixed(precision)));
      } else if (e.key === "Home") {
        e.preventDefault();
        onChange(min);
      } else if (e.key === "End") {
        e.preventDefault();
        onChange(max);
      }
    },
    [min, max, step, value, onChange],
  );

  const showDetails = isHovered || isDragging;

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className={cn(
        "relative h-6 rounded-[6px] bg-stone-100 dark:bg-stone-800 select-none cursor-ew-resize overflow-clip",
        "focus-visible:outline-1 focus-visible:outline-black dark:focus-visible:outline-white focus-visible:outline-offset-[-1px]",
        className,
      )}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => {
        if (!isDragging) setIsHovered(false);
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      {/* Fill track */}
      <div
        className="absolute inset-y-0 left-0 bg-stone-200 dark:bg-stone-700"
        style={{ width: `${fillPercent}%` }}
      />

      {/* Step indicators (shown on hover/drag) */}
      {showDetails &&
        indicators.map((pos, i) => (
          <div
            key={i}
            className="absolute top-1/2 -translate-y-1/2 rounded-[3px] bg-black/15 dark:bg-white/15"
            style={{ left: `${pos * 100}%`, width: 1, height: 4 }}
          />
        ))}

      {/* Handle (shown on hover/drag) */}
      {showDetails && (
        <div
          className="absolute top-1/2 -translate-y-1/2 rounded-[3px] bg-white"
          style={{ left: `${fillPercent}%`, width: 2, height: 16, marginLeft: -5 }}
        />
      )}

      {/* Label + Value */}
      <div className="absolute inset-0 flex items-center justify-between pl-1.5 pr-2 pointer-events-none overflow-clip whitespace-nowrap">
        <span className="text-[11px] font-[450] tracking-[0.055px] text-stone-900 dark:text-stone-100">
          {label}
        </span>
        <span className="text-[11px] font-[450] tracking-[0.055px] text-stone-900 dark:text-stone-100">
          {displayValue}
        </span>
      </div>
    </div>
  );
}

LabelSlider.displayName = "LabelSlider";

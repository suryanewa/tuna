/**
 * SliderInput — horizontal fill-track slider with label and value display.
 * Equivalent to the portfolio editor's LabelSlider component.
 */

import { useState, useRef, useCallback, useMemo } from "react";

export interface SliderInputProps {
  label: string;
  prop: string;
  value: string | undefined;
  min: number;
  max: number;
  step?: number;
  onChange: (prop: string, value: string) => void;
}

export function SliderInput({
  label, prop, value, min, max, step = 0.01, onChange,
}: SliderInputProps) {
  const [localValue, setLocalValue] = useState(value || "0");

  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setLocalValue(value || "0");
  }

  const numValue = parseFloat(localValue) || 0;
  const range = max - min;
  const fillPercent = range > 0 ? Math.max(0, Math.min(1, (numValue - min) / range)) * 100 : 0;
  const precision = step < 1 ? Math.max(0, -Math.floor(Math.log10(step))) : 0;

  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const computeFromX = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return numValue;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    let raw = min + ratio * range;
    raw = Math.round(raw / step) * step;
    raw = Math.max(min, Math.min(max, raw));
    return Number(raw.toFixed(precision));
  }, [min, max, range, step, precision, numValue]);

  const updateValue = useCallback((newNum: number) => {
    const str = String(newNum);
    setLocalValue(str);
    onChange(prop, str);
  }, [prop, onChange]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateValue(computeFromX(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updateValue(computeFromX(e.clientX));
  };

  const handlePointerUp = () => setIsDragging(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      updateValue(Number(Math.max(min, numValue - step).toFixed(precision)));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      updateValue(Number(Math.min(max, numValue + step).toFixed(precision)));
    }
  };

  const showDetails = isHovered || isDragging;
  const displayValue = step >= 1 ? String(Math.round(numValue)) : numValue.toFixed(precision);

  const indicators = useMemo(() => {
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
      if (frac > 0.03 && frac < 0.97) positions.push(frac);
      v = +(v + interval).toFixed(10);
    }
    return positions;
  }, [min, max, range]);

  return (
    <div
      ref={trackRef}
      className="composer-slider"
      tabIndex={0}
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={numValue}
      aria-label={label}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => { if (!isDragging) setIsHovered(false); }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      <div className="composer-slider-fill" style={{ width: `${fillPercent}%` }} />
      {showDetails && indicators.map((pos, i) => (
        <div key={i} className="composer-slider-indicator" style={{ left: `${pos * 100}%` }} />
      ))}
      {showDetails && (
        <div className="composer-slider-handle" style={{ left: `${fillPercent}%` }} />
      )}
      <div className="composer-slider-labels">
        <span className="composer-slider-label">{label}</span>
        <span className="composer-slider-value">{displayValue}</span>
      </div>
    </div>
  );
}

/**
 * GradientEditor — inline gradient editor for the property panel.
 *
 * Shows: gradient stop bar, angle input, reverse/rotate buttons,
 * stops list with position + ColorInput + remove per stop.
 * All inline — no dialogs. Reuses the existing ColorInput component.
 */

import { useState, useCallback } from "react";
import type { GradientFill } from "./gradient-utils";
import { interpolateColor, gradientBarCss } from "./gradient-utils";
import { GradientStopBar } from "./gradient-stop-bar";
import { ColorInput } from "./color-input";
import { hexToRgba, parseCssColor } from "./color-utils";
import { IconArrowLeftRight } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconArrowLeftRight";
import { IconArrowRotateClockwise } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconArrowRotateClockwise";
import { IconPlusLarge } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconPlusLarge";
import { IconMinusLarge } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconMinusLarge";
import { Tooltip } from "./tooltip";

export interface GradientEditorProps {
  gradient: GradientFill;
  onChange: (gradient: GradientFill) => void;
}

export function GradientEditor({ gradient, onChange }: GradientEditorProps) {
  const [selectedStop, setSelectedStop] = useState(0);
  const [angleInput, setAngleInput] = useState(`${gradient.angle}°`);
  const [isEditingAngle, setIsEditingAngle] = useState(false);

  // Sync angle display from parent when not editing
  const [prevAngle, setPrevAngle] = useState(gradient.angle);
  if (gradient.angle !== prevAngle) {
    setPrevAngle(gradient.angle);
    if (!isEditingAngle) setAngleInput(`${gradient.angle}°`);
  }

  // ── Gradient bar handlers ──

  const handleStopPositionDrag = useCallback(
    (index: number, position: number) => {
      const newStops = gradient.stops.map((s, i) =>
        i === index ? { ...s, position } : s,
      );
      onChange({ ...gradient, stops: newStops });
    },
    [gradient, onChange],
  );

  const handleBarAddStop = useCallback(
    (position: number, color: string) => {
      const newStops = [...gradient.stops, { color, position, opacity: 100 }];
      onChange({ ...gradient, stops: newStops });
      setSelectedStop(newStops.length - 1);
    },
    [gradient, onChange],
  );

  // ── Control handlers ──

  const handleAngleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setIsEditingAngle(true);
      const raw = e.target.value;
      setAngleInput(raw);
      const cleaned = raw.replace(/°/g, "").trim();
      const val = parseInt(cleaned, 10);
      if (!isNaN(val)) {
        onChange({ ...gradient, angle: ((val % 360) + 360) % 360 });
      }
    },
    [gradient, onChange],
  );

  const handleAngleBlur = useCallback(() => {
    setIsEditingAngle(false);
    const cleaned = angleInput.replace(/°/g, "").trim();
    const val = parseInt(cleaned, 10);
    const finalAngle = isNaN(val) ? gradient.angle : ((val % 360) + 360) % 360;
    onChange({ ...gradient, angle: finalAngle });
    setAngleInput(`${finalAngle}°`);
  }, [angleInput, gradient, onChange]);

  const handleReverse = useCallback(() => {
    const reversed = gradient.stops.map((s) => ({
      ...s,
      position: 1 - s.position,
    }));
    reversed.reverse();
    onChange({ ...gradient, stops: reversed });
  }, [gradient, onChange]);

  const handleRotate = useCallback(() => {
    onChange({ ...gradient, angle: (gradient.angle + 45) % 360 });
  }, [gradient, onChange]);

  const handleAddStop = useCallback(() => {
    const color = interpolateColor(gradient.stops, 0.5);
    const newStops = [...gradient.stops, { color, position: 0.5, opacity: 100 }];
    onChange({ ...gradient, stops: newStops });
    setSelectedStop(newStops.length - 1);
  }, [gradient, onChange]);

  // ── Stop row handlers ──

  const handleRemoveStop = useCallback(
    (index: number) => {
      if (gradient.stops.length <= 2) return;
      const newStops = gradient.stops.filter((_, i) => i !== index);
      onChange({ ...gradient, stops: newStops });
      if (selectedStop >= newStops.length) setSelectedStop(newStops.length - 1);
      else if (selectedStop === index && selectedStop > 0) setSelectedStop(selectedStop - 1);
    },
    [gradient, onChange, selectedStop],
  );

  const handleStopPositionInput = useCallback(
    (index: number, value: string) => {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed)) return;
      const clamped = Math.max(0, Math.min(100, parsed));
      const newStops = gradient.stops.map((s, i) =>
        i === index ? { ...s, position: clamped / 100 } : s,
      );
      onChange({ ...gradient, stops: newStops });
    },
    [gradient, onChange],
  );

  const handleStopColorChange = useCallback(
    (index: number, _prop: string, cssValue: string) => {
      const { hex, opacity } = parseCssColor(cssValue);
      const newStops = gradient.stops.map((s, i) =>
        i === index ? { ...s, color: hex, opacity } : s,
      );
      onChange({ ...gradient, stops: newStops });
    },
    [gradient, onChange],
  );

  const showAngle = gradient.type !== "radial";

  // Sort stops for display but keep original indices
  const sortedStops = gradient.stops
    .map((stop, index) => ({ stop, index }))
    .sort((a, b) => a.stop.position - b.stop.position);

  return (
    <div className="composer-gradient-editor">
      {/* Gradient stop bar */}
      <GradientStopBar
        stops={gradient.stops}
        selectedIndex={selectedStop}
        onSelectStop={setSelectedStop}
        onStopPositionChange={handleStopPositionDrag}
        onAddStop={handleBarAddStop}
        gradientCss={gradientBarCss(gradient.stops)}
      />

      {/* Controls row: angle + reverse + rotate */}
      <div className="composer-gradient-controls">
        {showAngle && (
          <input
            className="composer-gradient-angle-input"
            type="text"
            value={isEditingAngle ? angleInput : `${gradient.angle}°`}
            onFocus={(e) => {
              setIsEditingAngle(true);
              setAngleInput(String(gradient.angle));
              // Select just the number on focus
              requestAnimationFrame(() => e.target.select());
            }}
            onBlur={handleAngleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                const step = e.shiftKey ? 15 : 1;
                const delta = e.key === "ArrowUp" ? step : -step;
                const newAngle = ((gradient.angle + delta) % 360 + 360) % 360;
                onChange({ ...gradient, angle: newAngle });
              }
            }}
            onChange={handleAngleInputChange}
          />
        )}
        <div className="composer-gradient-actions">
          <Tooltip content="Reverse gradient direction">
            <button
              type="button"
              className="composer-gradient-action-btn"
              onClick={handleReverse}
            >
              <IconArrowLeftRight size={20} />
            </button>
          </Tooltip>
          <Tooltip content="Rotate gradient 45°">
            <button
              type="button"
              className="composer-gradient-action-btn"
              onClick={handleRotate}
            >
              <IconArrowRotateClockwise size={20} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Stops header */}
      <div className="composer-gradient-stops-header">
        <span className="composer-gradient-stops-label">Stops</span>
        <Tooltip content="Add color stop">
          <button
            type="button"
            className="composer-gradient-action-btn"
            onClick={handleAddStop}
          >
            <IconPlusLarge size={20} />
          </button>
        </Tooltip>
      </div>

      {/* Stop rows */}
      <div className="composer-gradient-stops-list">
        {sortedStops.map(({ stop, index }) => (
          <div key={index} className="composer-gradient-stop-row">
            {/* Position */}
            <div className="composer-gradient-stop-pos">
              <input
                className="composer-gradient-stop-pos-input"
                type="text"
                inputMode="numeric"
                defaultValue={Math.round(stop.position * 100)}
                key={`${index}-${Math.round(stop.position * 100)}`}
                onBlur={(e) => handleStopPositionInput(index, e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              />
              <span className="composer-gradient-stop-pos-unit">%</span>
            </div>

            {/* Color input (reuses existing component) */}
            <div className="composer-gradient-stop-color">
              <ColorInput
                prop={`stop-${index}`}
                value={hexToRgba(stop.color, stop.opacity ?? 100)}
                onChange={(_prop, val) => handleStopColorChange(index, _prop, val)}
              />
            </div>

            {/* Remove */}
            <Tooltip content="Remove color stop">
              <button
                type="button"
                className="composer-gradient-action-btn remove"
                disabled={gradient.stops.length <= 2}
                onClick={() => handleRemoveStop(index)}
              >
                <IconMinusLarge size={20} />
              </button>
            </Tooltip>
          </div>
        ))}
      </div>
    </div>
  );
}

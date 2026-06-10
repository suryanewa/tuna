/**
 * GradientEditor — inline gradient editor for the property panel.
 *
 * Shows: gradient stop bar, angle input, reverse/rotate buttons,
 * stops list with position + ColorInput + remove per stop.
 * All inline — no dialogs. Reuses the existing ColorInput component.
 */

import { useState, useCallback, useEffect } from "react";
import type { GradientFill } from "./gradient-utils";
import type { DesignVariable, VariableMatch } from "../variables/types";
import { interpolateColor, gradientBarCss } from "./gradient-utils";
import { GradientStopBar } from "./gradient-stop-bar";
import { ColorInput } from "./color-input";
import { ChangeIndicator } from "./change-indicator";
import { hexToRgba, parseCssColor } from "./color-utils";
import { FlipHorizontalSmall, Rotate, Plus, Minus } from "./icons";
import { Tooltip } from "./tooltip";

export interface GradientEditorProps {
  gradient: GradientFill;
  onChange: (gradient: GradientFill) => void;
  /** Original gradient state for change tracking (undefined if fill was originally solid) */
  originalGradient?: GradientFill;
  /** Whether this gradient was created by switching from solid fill */
  isNewGradient?: boolean;
}

export function GradientEditor({ gradient, onChange, originalGradient, isNewGradient }: GradientEditorProps) {
  const [selectedStop, setSelectedStop] = useState(0);
  const [angleInput, setAngleInput] = useState(`${gradient.angle}°`);
  const [isEditingAngle, setIsEditingAngle] = useState(false);

  // Per-stop variable associations (local state — not persisted to change tracker)
  const [stopVariables, setStopVariables] = useState<Map<number, VariableMatch>>(new Map());

  // ── Per-stop change tracking ──
  // When isNewGradient, no stop-level change dots (the fill mode change dot covers it).
  // Otherwise compare each stop against originalGradient.
  const isStopColorChanged = useCallback((index: number): boolean => {
    if (isNewGradient || !originalGradient) return false;
    const origStop = originalGradient.stops[index];
    if (!origStop) return true; // new stop
    const curStop = gradient.stops[index];
    if (!curStop) return false;
    return curStop.color !== origStop.color || (curStop.opacity ?? 100) !== (origStop.opacity ?? 100);
  }, [gradient.stops, originalGradient, isNewGradient]);

  const isStopPositionChanged = useCallback((index: number): boolean => {
    if (isNewGradient || !originalGradient) return false;
    const origStop = originalGradient.stops[index];
    if (!origStop) return true; // new stop
    const curStop = gradient.stops[index];
    if (!curStop) return false;
    return curStop.position !== origStop.position;
  }, [gradient.stops, originalGradient, isNewGradient]);

  const resetStopColor = useCallback((index: number) => {
    if (!originalGradient) return;
    const origStop = originalGradient.stops[index];
    if (!origStop) {
      // New stop — remove it
      const newStops = gradient.stops.filter((_, i) => i !== index);
      onChange({ ...gradient, stops: newStops });
    } else {
      const newStops = [...gradient.stops];
      newStops[index] = { ...newStops[index], color: origStop.color, opacity: origStop.opacity };
      onChange({ ...gradient, stops: newStops });
    }
  }, [gradient, originalGradient, onChange]);

  const resetStopPosition = useCallback((index: number) => {
    if (!originalGradient) return;
    const origStop = originalGradient.stops[index];
    if (!origStop) return;
    const newStops = [...gradient.stops];
    newStops[index] = { ...newStops[index], position: origStop.position };
    onChange({ ...gradient, stops: newStops });
  }, [gradient, originalGradient, onChange]);

  // Sync angle display from parent when not editing
  useEffect(() => {
    if (isEditingAngle) return;
    setAngleInput(`${gradient.angle}°`);
  }, [gradient.angle, isEditingAngle]);

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
    <div className="retune-gradient-editor">
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
      <div className="retune-gradient-controls">
        <input
          className="retune-gradient-angle-input"
          type="text"
          value={showAngle ? (isEditingAngle ? angleInput : `${gradient.angle}°`) : "–"}
          readOnly={!showAngle}
          disabled={!showAngle}
          onFocus={showAngle ? (e) => {
            setIsEditingAngle(true);
            setAngleInput(String(gradient.angle));
            requestAnimationFrame(() => e.target.select());
          } : undefined}
          onBlur={showAngle ? handleAngleBlur : undefined}
          onKeyDown={showAngle ? (e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const step = e.shiftKey ? 15 : 1;
              const delta = e.key === "ArrowUp" ? step : -step;
              const newAngle = ((gradient.angle + delta) % 360 + 360) % 360;
              onChange({ ...gradient, angle: newAngle });
            }
          } : undefined}
          onChange={showAngle ? handleAngleInputChange : undefined}
        />
        <div className="retune-gradient-actions">
          <Tooltip content="Reverse gradient direction">
            <button
              type="button"
              className="retune-gradient-action-btn"
              onClick={handleReverse}
            >
              <FlipHorizontalSmall />
            </button>
          </Tooltip>
          <Tooltip content="Rotate gradient 45°">
            <button
              type="button"
              className="retune-gradient-action-btn"
              disabled={!showAngle}
              onClick={handleRotate}
            >
              <Rotate />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Stops header */}
      <div className="retune-gradient-stops-header">
        <span className="retune-gradient-stops-label">Stops</span>
        <Tooltip content="Add color stop">
          <button
            type="button"
            className="retune-gradient-action-btn"
            onClick={handleAddStop}
          >
            <Plus />
          </button>
        </Tooltip>
      </div>

      {/* Stop rows */}
      <div className="retune-gradient-stops-list">
        {sortedStops.map(({ stop, index }) => (
          <div key={index} className="retune-gradient-stop-row">
            {/* Position */}
            <div className="retune-gradient-stop-pos">
              <ChangeIndicator isChanged={isStopPositionChanged(index)} onReset={() => resetStopPosition(index)} />
              <input
                className="retune-gradient-stop-pos-input"
                type="text"
                inputMode="numeric"
                defaultValue={Math.round(stop.position * 100)}
                key={`${index}-${Math.round(stop.position * 100)}`}
                onBlur={(e) => handleStopPositionInput(index, e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              />
              <span className="retune-gradient-stop-pos-unit">%</span>
            </div>

            {/* Color input (reuses existing component) */}
            <div className="retune-gradient-stop-color">
              <ColorInput
                prop={`stop-${index}`}
                value={hexToRgba(stop.color, stop.opacity ?? 100)}
                onChange={(_prop, val) => {
                  handleStopColorChange(index, _prop, val);
                  // Clear variable state when user manually changes color
                  if (stopVariables.has(index)) {
                    setStopVariables(prev => { const next = new Map(prev); next.delete(index); return next; });
                  }
                }}
                property="backgroundColor"
                variableMatch={stopVariables.get(index)}
                onVariableApply={(v) => {
                  const val = Object.values(v.values)[0];
                  if (val) handleStopColorChange(index, `stop-${index}`, val);
                  setStopVariables(prev => new Map(prev).set(index, { variable: v, property: "background-color" }));
                }}
                onVariableSelect={(oldV, newV) => {
                  const val = Object.values(newV.values)[0];
                  if (val) handleStopColorChange(index, `stop-${index}`, val);
                  setStopVariables(prev => new Map(prev).set(index, { variable: newV, property: "background-color" }));
                }}
                onVariableUnlink={() => {
                  setStopVariables(prev => { const next = new Map(prev); next.delete(index); return next; });
                }}
                isChanged={isStopColorChanged(index)}
                onReset={() => resetStopColor(index)}
              />
            </div>

            {/* Remove */}
            <Tooltip content="Remove color stop">
              <button
                type="button"
                className="retune-gradient-action-btn remove"
                disabled={gradient.stops.length <= 2}
                onClick={() => handleRemoveStop(index)}
              >
                <Minus />
              </button>
            </Tooltip>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { ColorInput, type GradientFill, type GradientStop } from "../ui/color-input";
import { NumberInput } from "../ui/number-input";
import { GradientStopBar } from "./GradientStopBar";
import { hexToRgb, rgbToHex } from "./color-utils";
import { Dropdown, type DropdownOption } from "../ui/dropdown";
import { IconButton } from "../ui/icon-button";
import {
  FlipHorizontalSmall,
  Rotate,
  PlusSmall,
  MinusSmall,
} from "@/components/icons/editor";

// ============================================================================
// Types
// ============================================================================

interface GradientEditorProps {
  gradient: GradientFill;
  onGradientChange: (gradient: GradientFill) => void;
  selectedStopIndex: number;
  onSelectStop: (index: number) => void;
  onStopSwatchClick: (index: number) => void;
}

// ============================================================================
// Constants
// ============================================================================

const GRADIENT_TYPE_OPTIONS: DropdownOption[] = [
  { value: "linear", label: "Linear" },
  { value: "radial", label: "Radial" },
  { value: "conic", label: "Conic" },
];

// ============================================================================
// Helpers
// ============================================================================

function buildGradientBarCss(stops: GradientStop[]): string {
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const stopsCss = sorted
    .map((s) => {
      const alpha = (s.opacity ?? 100) / 100;
      const color = alpha < 1 ? hexToRgba(s.color, alpha) : s.color;
      return `${color} ${Math.round(s.position * 100)}%`;
    })
    .join(", ");
  return `linear-gradient(to right, ${stopsCss})`;
}

function interpolateColorAtPosition(
  stops: GradientStop[],
  position: number,
): string {
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

function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ============================================================================
// GradientEditor
// ============================================================================

export const GradientEditor = React.memo(function GradientEditor({
  gradient,
  onGradientChange,
  selectedStopIndex,
  onSelectStop,
  onStopSwatchClick,
}: GradientEditorProps) {
  // ---- Type change ----
  const handleTypeChange = React.useCallback(
    (value: string) => {
      onGradientChange({
        ...gradient,
        type: value as GradientFill["type"],
      });
    },
    [gradient, onGradientChange],
  );

  // ---- Reverse stops ----
  const handleReverse = React.useCallback(() => {
    const reversed = gradient.stops.map((s) => ({
      ...s,
      position: 1 - s.position,
    }));
    reversed.reverse();
    onGradientChange({ ...gradient, stops: reversed });
  }, [gradient, onGradientChange]);

  // ---- Rotate angle +45 ----
  const handleRotate = React.useCallback(() => {
    onGradientChange({
      ...gradient,
      angle: (gradient.angle + 45) % 360,
    });
  }, [gradient, onGradientChange]);

  // ---- Add stop ----
  const handleAddStop = React.useCallback(() => {
    const color = interpolateColorAtPosition(gradient.stops, 0.5);
    const newStops = [...gradient.stops, { color, position: 0.5 }];
    onGradientChange({ ...gradient, stops: newStops });
    onSelectStop(newStops.length - 1);
  }, [gradient, onGradientChange, onSelectStop]);

  // ---- Add stop from bar click ----
  const handleBarAddStop = React.useCallback(
    (position: number, color: string) => {
      const newStops = [...gradient.stops, { color, position }];
      onGradientChange({ ...gradient, stops: newStops });
      onSelectStop(newStops.length - 1);
    },
    [gradient, onGradientChange, onSelectStop],
  );

  // ---- Stop position change (from drag) ----
  const handleStopPositionChange = React.useCallback(
    (index: number, position: number) => {
      const newStops = gradient.stops.map((s, i) =>
        i === index ? { ...s, position } : s,
      );
      onGradientChange({ ...gradient, stops: newStops });
    },
    [gradient, onGradientChange],
  );

  // ---- Remove stop ----
  const handleRemoveStop = React.useCallback(
    (index: number) => {
      if (gradient.stops.length <= 2) return;
      const newStops = gradient.stops.filter((_, i) => i !== index);
      onGradientChange({ ...gradient, stops: newStops });
      if (selectedStopIndex >= newStops.length) {
        onSelectStop(newStops.length - 1);
      } else if (selectedStopIndex === index && selectedStopIndex > 0) {
        onSelectStop(selectedStopIndex - 1);
      }
    },
    [gradient, onGradientChange, selectedStopIndex, onSelectStop],
  );

  // ---- Stop position input commit ----
  const handlePositionCommit = React.useCallback(
    (index: number, rawValue: string) => {
      const parsed = parseInt(rawValue, 10);
      if (isNaN(parsed)) return;
      const clamped = Math.max(0, Math.min(100, parsed));
      const newStops = gradient.stops.map((s, i) =>
        i === index ? { ...s, position: clamped / 100 } : s,
      );
      onGradientChange({ ...gradient, stops: newStops });
    },
    [gradient, onGradientChange],
  );

  // ---- Stop color change (from inline hex edit) ----
  const handleStopColorChange = React.useCallback(
    (index: number, hex: string) => {
      const newStops = gradient.stops.map((s, i) =>
        i === index ? { ...s, color: hex } : s,
      );
      onGradientChange({ ...gradient, stops: newStops });
    },
    [gradient, onGradientChange],
  );

  // ---- Stop opacity change ----
  const handleOpacityCommit = React.useCallback(
    (index: number, rawValue: string) => {
      const parsed = parseInt(rawValue, 10);
      if (isNaN(parsed)) return;
      const clamped = Math.max(0, Math.min(100, parsed));
      const newStops = gradient.stops.map((s, i) =>
        i === index ? { ...s, opacity: clamped } : s,
      );
      onGradientChange({ ...gradient, stops: newStops });
    },
    [gradient, onGradientChange],
  );

  return (
    <div className="flex flex-col min-h-0 pt-3">
      {/* 1. Type + controls row */}
      <div className="flex items-center justify-between pl-4 pr-2 py-1">
        <Dropdown
          value={gradient.type}
          onValueChange={handleTypeChange}
          options={GRADIENT_TYPE_OPTIONS}
          className="w-[96px]"
        />
        <div className="flex items-center gap-0">
          <IconButton icon={FlipHorizontalSmall} onClick={handleReverse} />
          <IconButton icon={Rotate} onClick={handleRotate} />
        </div>
      </div>

      {/* 2. Gradient stop bar */}
      <div className="px-4 py-1">
        <GradientStopBar
          stops={gradient.stops}
          selectedIndex={selectedStopIndex}
          onSelectStop={onSelectStop}
          onStopPositionChange={handleStopPositionChange}
          onAddStop={handleBarAddStop}
          gradientCss={buildGradientBarCss(gradient.stops)}
        />
      </div>

      {/* 3. Stops header */}
      <div className="flex items-center justify-between pl-4 pr-2 py-1">
        <span className="text-[11px] font-[550] tracking-[0.055px] text-stone-900 dark:text-stone-100">
          Stops
        </span>
        <IconButton icon={PlusSmall} onClick={handleAddStop} />
      </div>

      {/* 4. Stop rows (sorted by position for display) */}
      <div className="flex flex-col min-h-0 overflow-y-auto overscroll-none pb-3">
        {gradient.stops
          .map((stop, index) => ({ stop, index }))
          .sort((a, b) => a.stop.position - b.stop.position)
          .map(({ stop, index }) => (
          <StopRow
            key={index}
            stop={stop}
            index={index}
            isSelected={selectedStopIndex === index}
            canRemove={gradient.stops.length > 2}
            onSelect={onSelectStop}
            onSwatchClick={onStopSwatchClick}
            onPositionCommit={handlePositionCommit}
            onOpacityCommit={handleOpacityCommit}
            onColorChange={handleStopColorChange}
            onRemove={handleRemoveStop}
          />
        ))}
      </div>
    </div>
  );
});

// ============================================================================
// StopRow (internal)
// ============================================================================

interface StopRowProps {
  stop: GradientStop;
  index: number;
  isSelected: boolean;
  canRemove: boolean;
  onSelect: (index: number) => void;
  onSwatchClick: (index: number) => void;
  onPositionCommit: (index: number, value: string) => void;
  onOpacityCommit: (index: number, value: string) => void;
  onColorChange: (index: number, hex: string) => void;
  onRemove: (index: number) => void;
}

const StopRow = React.memo(function StopRow({
  stop,
  index,
  isSelected,
  canRemove,
  onSelect,
  onSwatchClick,
  onPositionCommit,
  onOpacityCommit,
  onColorChange,
  onRemove,
}: StopRowProps) {
  const handleRowClick = React.useCallback(() => {
    onSelect(index);
  }, [index, onSelect]);

  const handlePositionChange = React.useCallback(
    (v: string | undefined) => {
      if (v !== undefined) onPositionCommit(index, v);
    },
    [index, onPositionCommit],
  );

  const handleColorChange = React.useCallback(
    (hex: string) => onColorChange(index, hex),
    [index, onColorChange],
  );

  const handleOpacityChange = React.useCallback(
    (opacity: number) => onOpacityCommit(index, String(opacity)),
    [index, onOpacityCommit],
  );

  const handleSwatchClick = React.useCallback(() => {
    onSwatchClick(index);
  }, [index, onSwatchClick]);

  const handleRemove = React.useCallback(() => {
    onRemove(index);
  }, [index, onRemove]);

  return (
    <div
      className={`flex items-center gap-2 pl-4 pr-2 py-1 cursor-pointer ${
        isSelected ? "bg-blue-200 dark:bg-blue-900/40" : ""
      }`}
      onClick={handleRowClick}
    >
      {/* Position input */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="w-[48px] shrink-0" onClick={(e) => e.stopPropagation()}>
        <NumberInput
          value={String(Math.round(stop.position * 100))}
          onChange={handlePositionChange}
          min={0}
          max={100}
          className="min-w-0"
        />
      </div>

      {/* Color input */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
        <ColorInput
          value={stop.color}
          onChange={handleColorChange}
          opacity={stop.opacity ?? 100}
          onOpacityChange={handleOpacityChange}
          onClick={handleSwatchClick}
          className="min-w-0"
        />
      </div>

      {/* Remove button */}
      <IconButton
        icon={MinusSmall}
        disabled={!canRemove}
        onClick={(e) => {
          e.stopPropagation();
          handleRemove();
        }}
      />
    </div>
  );
});

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ComboInput, type ComboInputOption } from "./combo-input";
import { parseNumericInput } from "./numeric-validation";
import { IconButton } from "./icon-button";
import {
  AlPaddingHorizontal,
  AlPaddingVertical,
  AlPaddingTop,
  AlPaddingRight,
  AlPaddingBottom,
  AlPaddingLeft,
  AlPaddingSides,
} from "@/components/icons/editor";

export type SpacingMode = "xy" | "individual";
export type SpacingSide = "x" | "y" | "top" | "right" | "bottom" | "left";

export interface SpacingControlProps {
  mode: SpacingMode;
  onModeChange: (mode: SpacingMode) => void;

  // XY mode values
  x: number | undefined;
  y: number | undefined;

  // Individual mode values
  top: number | undefined;
  right: number | undefined;
  bottom: number | undefined;
  left: number | undefined;

  onChange: (side: SpacingSide, value: number | undefined) => void;
  /** Called when user types comma-separated values in XY mode (e.g. "8, 12") */
  onCommaChange?: (axis: "x" | "y", value1: number, value2: number) => void;

  disabled?: boolean;
  /** Value to reset to when input is cleared and blurred (Figma behavior) */
  resetOnClear?: string;
  className?: string;
}

// Common spacing presets
const spacingOptions: ComboInputOption[] = [
  { value: "0", label: "0" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "4", label: "4" },
  { value: "6", label: "6" },
  { value: "8", label: "8" },
  { value: "10", label: "10" },
  { value: "12", label: "12" },
  { value: "16", label: "16" },
  { value: "20", label: "20" },
  { value: "24", label: "24" },
  { value: "32", label: "32" },
  { value: "40", label: "40" },
  { value: "48", label: "48" },
  { value: "64", label: "64" },
];

export function SpacingControl({
  mode,
  onModeChange,
  x,
  y,
  top,
  right,
  bottom,
  left,
  onChange,
  onCommaChange,
  disabled = false,
  resetOnClear,
  className,
}: SpacingControlProps) {
  const handleValueChange = (side: SpacingSide, value: string | undefined) => {
    if (value === undefined || value === "") {
      onChange(side, undefined);
    } else {
      // Check for comma-separated values in XY mode
      if (mode === "xy" && (side === "x" || side === "y") && value.includes(",")) {
        const parts = value.split(",").map(s => s.trim());
        if (parts.length === 2) {
          const v1 = parseNumericInput(parts[0]);
          const v2 = parseNumericInput(parts[1]);
          if (v1 !== undefined && v2 !== undefined && onCommaChange) {
            onCommaChange(side, v1, v2);
            return;
          }
        }
      }
      onChange(side, parseNumericInput(value) ?? undefined);
    }
  };

  const toggleMode = () => {
    onModeChange(mode === "xy" ? "individual" : "xy");
  };

  const isIndividual = mode === "individual";

  // In XY mode, derive display from individual values to show comma-separated when sides differ
  const effectiveLeft = left ?? x ?? 0;
  const effectiveRight = right ?? x ?? 0;
  const effectiveTop = top ?? y ?? 0;
  const effectiveBottom = bottom ?? y ?? 0;

  const xDisplay = effectiveLeft === effectiveRight
    ? String(effectiveLeft)
    : `${effectiveLeft}, ${effectiveRight}`;
  const yDisplay = effectiveTop === effectiveBottom
    ? String(effectiveTop)
    : `${effectiveTop}, ${effectiveBottom}`;

  return (
    <div className={cn("flex gap-2", isIndividual ? "items-start" : "items-center", className)}>
      {/* Inputs container */}
      <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
        {mode === "xy" ? (
          <>
            {/* X (horizontal) */}
            <ComboInput
              value={xDisplay}
              onChange={(v) => handleValueChange("x", v)}
              options={spacingOptions}
              leadIcon={AlPaddingHorizontal}
              disabled={disabled}
              resetOnClear={resetOnClear}
              min={0}
              step={1}
            />
            {/* Y (vertical) */}
            <ComboInput
              value={yDisplay}
              onChange={(v) => handleValueChange("y", v)}
              options={spacingOptions}
              leadIcon={AlPaddingVertical}
              disabled={disabled}
              resetOnClear={resetOnClear}
              min={0}
              step={1}
            />
          </>
        ) : (
          <>
            {/* Left */}
            <ComboInput
              value={left !== undefined ? String(left) : undefined}
              onChange={(v) => handleValueChange("left", v)}
              options={spacingOptions}
              leadIcon={AlPaddingLeft}
              disabled={disabled}
              resetOnClear={resetOnClear}
              min={0}
              step={1}
            />
            {/* Top */}
            <ComboInput
              value={top !== undefined ? String(top) : undefined}
              onChange={(v) => handleValueChange("top", v)}
              options={spacingOptions}
              leadIcon={AlPaddingTop}
              disabled={disabled}
              resetOnClear={resetOnClear}
              min={0}
              step={1}
            />
            {/* Right */}
            <ComboInput
              value={right !== undefined ? String(right) : undefined}
              onChange={(v) => handleValueChange("right", v)}
              options={spacingOptions}
              leadIcon={AlPaddingRight}
              disabled={disabled}
              resetOnClear={resetOnClear}
              min={0}
              step={1}
            />
            {/* Bottom */}
            <ComboInput
              value={bottom !== undefined ? String(bottom) : undefined}
              onChange={(v) => handleValueChange("bottom", v)}
              options={spacingOptions}
              leadIcon={AlPaddingBottom}
              disabled={disabled}
              resetOnClear={resetOnClear}
              min={0}
              step={1}
            />
          </>
        )}
      </div>

      {/* Mode toggle button */}
      <div className="shrink-0">
        <IconButton
          icon={AlPaddingSides}
          toggled={isIndividual}
          onToggle={toggleMode}
          disabled={disabled}
          aria-label={isIndividual ? "Use X/Y mode" : "Use individual sides"}
        />
      </div>
    </div>
  );
}

SpacingControl.displayName = "SpacingControl";

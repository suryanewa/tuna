"use client";

import * as React from "react";
import { IconButton } from "../ui/icon-button";
import type { DropdownMenuOption } from "../ui/dropdown-menu";
import {
  FillSolidSmall,
  FillGradientLinearSmall,
  BlendmodeSmall,
} from "@/components/icons/editor";

// ============================================================================
// Types
// ============================================================================

export type FillMode = "solid" | "gradient";

export type BlendMode =
  | "normal" | "multiply" | "screen" | "overlay"
  | "darken" | "lighten" | "color-dodge" | "color-burn"
  | "hard-light" | "soft-light" | "difference" | "exclusion"
  | "hue" | "saturation" | "color" | "luminosity";

interface OptionsRowProps {
  mode: FillMode;
  onModeChange: (mode: FillMode) => void;
  blendMode?: BlendMode;
  onBlendModeChange?: (mode: BlendMode) => void;
}

// ============================================================================
// Blend mode menu options
// ============================================================================

const blendModeOptions: DropdownMenuOption[] = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "darken", label: "Darken" },
  { value: "lighten", label: "Lighten" },
  { value: "color-dodge", label: "Color Dodge" },
  { value: "color-burn", label: "Color Burn" },
  { value: "hard-light", label: "Hard Light" },
  { value: "soft-light", label: "Soft Light" },
  { value: "difference", label: "Difference" },
  { value: "exclusion", label: "Exclusion" },
  { value: "hue", label: "Hue" },
  { value: "saturation", label: "Saturation" },
  { value: "color", label: "Color" },
  { value: "luminosity", label: "Luminosity" },
];

// ============================================================================
// Component
// ============================================================================

export const OptionsRow = React.memo(function OptionsRow({
  mode,
  onModeChange,
  blendMode,
  onBlendModeChange,
}: OptionsRowProps) {
  return (
    <div className="flex items-center justify-between p-2 border-b border-stone-200 dark:border-stone-800">
      {/* Fill type toggles */}
      <div className="flex items-center gap-1">
        <IconButton
          icon={FillSolidSmall}
          size="sm"
          toggled={mode === "solid"}
          onToggle={() => onModeChange("solid")}
          aria-label="Solid fill"
        />
        <IconButton
          icon={FillGradientLinearSmall}
          size="sm"
          toggled={mode === "gradient"}
          onToggle={() => onModeChange("gradient")}
          aria-label="Gradient fill"
        />
      </div>

      {/* Blend mode menu */}
      {onBlendModeChange && (
        <IconButton
          icon={BlendmodeSmall}
          size="sm"
          menuItems={blendModeOptions}
          menuValue={blendMode ?? "normal"}
          onMenuSelect={(item) => onBlendModeChange(item.value as BlendMode)}
          aria-label="Blend mode"
        />
      )}
    </div>
  );
});

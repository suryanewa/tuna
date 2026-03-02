"use client";

import * as React from "react";
import { SectionWrapper, SectionBody, SectionRow } from "./section-wrapper";
import { SectionHeader } from "../ui/section-header";
import { LabelSegmentedControl } from "../ui/segmented-control";
import { NumberInput } from "../ui/number-input";
import { ColorInput } from "../ui/color-input";
import { IconButton } from "../ui/icon-button";
import { ColorPickerDialog } from "../color-picker-dialog";
import {
  PlusSmall,
  MinusSmall,
  Angle,
  SunSmall,
  AllSmall,
} from "@/components/icons/editor";

// ============================================================================
// Types
// ============================================================================

export type ShadowType = "outside" | "inside";

export interface ShadowValue {
  type: ShadowType;
  angle: number;
  distance: number;
  brightness: number;
  elevation: number;
  color: string;
  opacity: number;
}

export interface ShadowSectionProps {
  shadow: ShadowValue | null;
  onShadowChange: (shadow: ShadowValue | null) => void;
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SHADOW_TYPE_OPTIONS = [
  { value: "outside" as const, label: "Outside" },
  { value: "inside" as const, label: "Inside" },
];

const DEFAULT_SHADOW: ShadowValue = {
  type: "outside",
  angle: 90,
  distance: 36,
  brightness: 10,
  elevation: 100,
  color: "#000000",
  opacity: 15,
};

// ============================================================================
// Component
// ============================================================================

export function ShadowSection({
  shadow,
  onShadowChange,
  disabled = false,
  className,
}: ShadowSectionProps) {
  const [pickerOpen, setPickerOpen] = React.useState(false);

  // Local state for inputs with unit suffixes (° and %) — only used while editing
  const [angleInput, setAngleInput] = React.useState(`${shadow?.angle ?? 0}°`);
  const [isEditingAngle, setIsEditingAngle] = React.useState(false);
  const [brightnessInput, setBrightnessInput] = React.useState(`${shadow?.brightness ?? 0}%`);
  const [isEditingBrightness, setIsEditingBrightness] = React.useState(false);
  const [elevationInput, setElevationInput] = React.useState(`${shadow?.elevation ?? 0}%`);
  const [isEditingElevation, setIsEditingElevation] = React.useState(false);

  // Derive display values: show prop when not editing, local state when editing
  const angleDisplay = isEditingAngle ? angleInput : `${shadow?.angle ?? 0}°`;
  const brightnessDisplay = isEditingBrightness ? brightnessInput : `${shadow?.brightness ?? 0}%`;
  const elevationDisplay = isEditingElevation ? elevationInput : `${shadow?.elevation ?? 0}%`;

  const handleAddShadow = () => {
    onShadowChange({ ...DEFAULT_SHADOW });
  };

  const handleRemoveShadow = () => {
    setPickerOpen(false);
    onShadowChange(null);
  };

  const handleNumericChange =
    (field: keyof ShadowValue) => (value: string | undefined) => {
      if (!shadow) return;
      const num = value === undefined ? 0 : parseFloat(value) || 0;
      onShadowChange({ ...shadow, [field]: num });
    };

  const handleSuffixInputChange = (
    field: keyof ShadowValue,
    suffix: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    setEditing: React.Dispatch<React.SetStateAction<boolean>>
  ) => (value: string | undefined) => {
    setEditing(true);
    setter(value ?? "");
    // Also propagate to parent for real-time updates (drag, arrow keys)
    if (!shadow) return;
    const cleaned = (value ?? "").replace(new RegExp(suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "").trim();
    const numValue = cleaned === "" ? 0 : Number(cleaned);
    if (!isNaN(numValue)) {
      onShadowChange({ ...shadow, [field]: numValue });
    }
  };

  const handleSuffixInputBlur = (
    field: keyof ShadowValue,
    suffix: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    setEditing: React.Dispatch<React.SetStateAction<boolean>>
  ) => (value: string | undefined) => {
    setEditing(false);
    if (!shadow) return;
    const cleaned = (value ?? "").replace(new RegExp(suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "").trim();
    const numValue = cleaned === "" ? 0 : Number(cleaned);
    const finalValue = isNaN(numValue) ? (shadow[field] as number) : numValue;
    onShadowChange({ ...shadow, [field]: finalValue });
    setter(`${finalValue}${suffix}`);
  };

  return (
    <SectionWrapper className={className}>
      <SectionHeader
        title="Shadow"
        isEmpty={!shadow}
        iconButton={
          !shadow
            ? {
                icon: PlusSmall,
                onClick: handleAddShadow,
                "aria-label": "Add shadow",
              }
            : undefined
        }
      />
      {shadow && (
        <SectionBody>
          {/* Row 1: Shadow type + remove button */}
          <SectionRow hasTrailingAction>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <LabelSegmentedControl
                  options={SHADOW_TYPE_OPTIONS}
                  value={shadow.type}
                  onValueChange={(value) =>
                    onShadowChange({ ...shadow, type: value })
                  }
                  disabled={disabled}
                  fullWidth
                />
              </div>
              <IconButton
                icon={MinusSmall}
                onClick={handleRemoveShadow}
                disabled={disabled}
                aria-label="Remove shadow"
                className="flex-shrink-0"
              />
            </div>
          </SectionRow>

          {/* Row 2: Angle + Distance */}
          <SectionRow>
            <div className="flex items-start gap-2">
              <NumberInput
                value={angleDisplay}
                onChange={handleSuffixInputChange("angle", "°", setAngleInput, setIsEditingAngle)}
                onBlur={handleSuffixInputBlur("angle", "°", setAngleInput, setIsEditingAngle)}
                leadIcon={Angle}
                min={0}
                max={360}
                disabled={disabled}
              />
              <NumberInput
                value={String(shadow.distance)}
                onChange={handleNumericChange("distance")}
                property="D"
                min={0}
                disabled={disabled}
              />
            </div>
          </SectionRow>

          {/* Row 3: Brightness + Elevation */}
          <SectionRow>
            <div className="flex items-start gap-2">
              <NumberInput
                value={brightnessDisplay}
                onChange={handleSuffixInputChange("brightness", "%", setBrightnessInput, setIsEditingBrightness)}
                onBlur={handleSuffixInputBlur("brightness", "%", setBrightnessInput, setIsEditingBrightness)}
                leadIcon={SunSmall}
                min={0}
                disabled={disabled}
              />
              <NumberInput
                value={elevationDisplay}
                onChange={handleSuffixInputChange("elevation", "%", setElevationInput, setIsEditingElevation)}
                onBlur={handleSuffixInputBlur("elevation", "%", setElevationInput, setIsEditingElevation)}
                leadIcon={AllSmall}
                min={0}
                disabled={disabled}
              />
            </div>
          </SectionRow>

          {/* Row 4: Color + Opacity */}
          <SectionRow>
            <ColorPickerDialog
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              trigger={
                <ColorInput
                  value={shadow.color}
                  onChange={(value) => onShadowChange({ ...shadow, color: value })}
                  opacity={shadow.opacity}
                  onOpacityChange={(opacity) => onShadowChange({ ...shadow, opacity })}
                  disabled={disabled}
                />
              }
              value={shadow.color}
              onChange={(value) => onShadowChange({ ...shadow, color: value })}
              opacity={shadow.opacity}
              onOpacityChange={(opacity) => onShadowChange({ ...shadow, opacity })}
              showOptions={false}
              prefix="shadow"
            />
          </SectionRow>
        </SectionBody>
      )}
    </SectionWrapper>
  );
}

ShadowSection.displayName = "ShadowSection";

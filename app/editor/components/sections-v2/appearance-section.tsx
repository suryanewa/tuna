"use client";

import * as React from "react";
import { SectionWrapper, SectionBody, SectionRow } from "./section-wrapper";
import { SectionHeader } from "../ui/section-header";
import { NumberInput } from "../ui/number-input";
import { Dropdown, type DropdownOption } from "../ui/dropdown";
import { ComboInput, type ComboInputOption } from "../ui/combo-input";
import { IconButton } from "../ui/icon-button";
import {
  Opacity,
  BlendmodeSmall,
  AllSmall,
  Corners,
  RadiusTopLeft,
  RadiusTopRight,
  RadiusBottomLeft,
  RadiusBottomRight,
  AdjustSmall,
} from "@/components/icons/editor";

// ============================================================================
// Types
// ============================================================================

export type BlendMode =
  | "normal" | "multiply" | "screen" | "overlay"
  | "darken" | "lighten" | "color-dodge" | "color-burn"
  | "hard-light" | "soft-light" | "difference" | "exclusion"
  | "hue" | "saturation" | "color" | "luminosity";

export type OverflowValue = "visible" | "hidden" | "scroll" | "auto";

export interface AppearanceSectionProps {
  // Row 1
  opacity: number;
  onOpacityChange: (value: number) => void;
  blendMode?: BlendMode;
  onBlendModeChange: (value: BlendMode) => void;

  // Row 2
  zIndex: string | undefined;
  onZIndexChange: (value: string | undefined) => void;
  cornerRadius: string | undefined;
  onCornerRadiusChange: (value: string | undefined) => void;

  // Row 3 (conditional)
  showIndividualCorners: boolean;
  onShowIndividualCornersChange: (show: boolean) => void;
  cornerRadiusTopLeft: string | undefined;
  onCornerRadiusTopLeftChange: (value: string | undefined) => void;
  cornerRadiusTopRight: string | undefined;
  onCornerRadiusTopRightChange: (value: string | undefined) => void;
  cornerRadiusBottomLeft: string | undefined;
  onCornerRadiusBottomLeftChange: (value: string | undefined) => void;
  cornerRadiusBottomRight: string | undefined;
  onCornerRadiusBottomRightChange: (value: string | undefined) => void;

  // Row 4
  overflow?: OverflowValue;
  onOverflowChange: (value: OverflowValue) => void;
  showIndividualOverflow: boolean;
  onShowIndividualOverflowChange: (show: boolean) => void;
  overflowX: OverflowValue;
  onOverflowXChange: (value: OverflowValue) => void;
  overflowY: OverflowValue;
  onOverflowYChange: (value: OverflowValue) => void;

  disabled?: boolean;
  /** Disable corner radius controls (e.g. for text elements) */
  cornerRadiusDisabled?: boolean;
  className?: string;
  /** When set, undefined values show this as placeholder (e.g. "Mixed" for multi-select) */
  mixedPlaceholder?: string;
}

// ============================================================================
// Constants
// ============================================================================

export const blendModeOptions: DropdownOption[] = [
  { value: "normal", label: "Normal" },
  { value: "darken", label: "Darken", separatorBefore: true },
  { value: "multiply", label: "Multiply" },
  { value: "color-burn", label: "Color Burn" },
  { value: "lighten", label: "Lighten", separatorBefore: true },
  { value: "screen", label: "Screen" },
  { value: "color-dodge", label: "Color Dodge" },
  { value: "overlay", label: "Overlay", separatorBefore: true },
  { value: "soft-light", label: "Soft Light" },
  { value: "hard-light", label: "Hard Light" },
  { value: "difference", label: "Difference", separatorBefore: true },
  { value: "exclusion", label: "Exclusion" },
  { value: "hue", label: "Hue", separatorBefore: true },
  { value: "saturation", label: "Saturation" },
  { value: "color", label: "Color" },
  { value: "luminosity", label: "Luminosity" },
];

const overflowOptions: DropdownOption[] = [
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
  { value: "scroll", label: "Scroll" },
  { value: "auto", label: "Auto" },
];

const cornerRadiusOptions: ComboInputOption[] = [
  { value: "0", label: "0" },
  { value: "2", label: "2" },
  { value: "4", label: "4" },
  { value: "6", label: "6" },
  { value: "8", label: "8" },
  { value: "12", label: "12" },
  { value: "16", label: "16" },
  { value: "20", label: "20" },
  { value: "24", label: "24" },
  { value: "32", label: "32" },
  { value: "9999", label: "Full" },
];

const labelClassName = "text-[9px] font-medium leading-4 tracking-[0.045px] text-stone-500 dark:text-stone-400";

// ============================================================================
// Component
// ============================================================================

export function AppearanceSection({
  opacity,
  onOpacityChange,
  blendMode,
  onBlendModeChange,
  zIndex,
  onZIndexChange,
  cornerRadius,
  onCornerRadiusChange,
  showIndividualCorners,
  onShowIndividualCornersChange,
  cornerRadiusTopLeft,
  onCornerRadiusTopLeftChange,
  cornerRadiusTopRight,
  onCornerRadiusTopRightChange,
  cornerRadiusBottomLeft,
  onCornerRadiusBottomLeftChange,
  cornerRadiusBottomRight,
  onCornerRadiusBottomRightChange,
  overflow,
  onOverflowChange,
  showIndividualOverflow,
  onShowIndividualOverflowChange,
  overflowX,
  onOverflowXChange,
  overflowY,
  onOverflowYChange,
  disabled = false,
  cornerRadiusDisabled = false,
  className,
  mixedPlaceholder,
}: AppearanceSectionProps) {
  // Local state for opacity input to handle % suffix
  const [opacityInput, setOpacityInput] = React.useState(`${opacity}%`);
  const [isEditingOpacity, setIsEditingOpacity] = React.useState(false);

  // Derive display value: show prop when not editing, local state when editing
  const opacityDisplay = isEditingOpacity ? opacityInput : `${opacity}%`;

  const handleOpacityInputChange = (value: string | undefined) => {
    setIsEditingOpacity(true);
    setOpacityInput(value ?? "");
    // Update canvas in real time as the user types
    const cleaned = (value ?? "").replace(/%/g, "").trim();
    const numValue = Number(cleaned);
    if (cleaned !== "" && !isNaN(numValue)) {
      onOpacityChange(Math.max(0, Math.min(100, numValue)));
    }
  };

  const handleOpacityBlur = (value: string | undefined) => {
    setIsEditingOpacity(false);
    const cleaned = (value ?? "").replace(/%/g, "").trim();
    const numValue = cleaned === "" ? 100 : Number(cleaned);
    const clamped = Math.max(0, Math.min(100, isNaN(numValue) ? opacity : numValue));
    onOpacityChange(clamped);
    setOpacityInput(`${clamped}%`);
  };

  return (
    <SectionWrapper className={className}>
      <SectionHeader title="Appearance" />
      <SectionBody>
        {/* Row 1: Opacity + Blend Mode */}
        <SectionRow>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0 flex flex-col">
              <span className={labelClassName}>Opacity</span>
              <NumberInput
                value={opacityDisplay}
                onChange={handleOpacityInputChange}
                onBlur={handleOpacityBlur}
                leadIcon={Opacity}
                min={0}
                max={100}
                step={1}
                disabled={disabled}
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <span className={labelClassName}>Blend Mode</span>
              <Dropdown
                value={blendMode ?? ""}
                onValueChange={(v) => onBlendModeChange(v as BlendMode)}
                options={blendModeOptions}
                leadIcon={BlendmodeSmall}
                menuWidth={120}
                disabled={disabled}
                placeholder={blendMode ? undefined : "Mixed"}
              />
            </div>
          </div>
        </SectionRow>

        {/* Row 2: Z Index + Corner Radius + Toggle */}
        <SectionRow hasTrailingAction>
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0 flex flex-col">
              <span className={labelClassName}>Z Index</span>
              <NumberInput
                value={zIndex}
                onChange={onZIndexChange}
                leadIcon={AllSmall}
                step={1}
                disabled={disabled}
                resetOnClear="auto"
                placeholder={zIndex === undefined && mixedPlaceholder ? mixedPlaceholder : undefined}
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <span className={labelClassName}>Corner Radius</span>
              <ComboInput
                value={cornerRadius}
                onChange={onCornerRadiusChange}
                options={cornerRadiusOptions}
                leadIcon={Corners}
                min={0}
                step={1}
                disabled={disabled || cornerRadiusDisabled}
                resetOnClear="0"
                placeholder={cornerRadius === undefined && mixedPlaceholder ? mixedPlaceholder : undefined}
              />
            </div>
            <IconButton
              icon={Corners}
              toggled={showIndividualCorners}
              onToggle={onShowIndividualCornersChange}
              disabled={disabled || cornerRadiusDisabled}
              aria-label="Toggle individual corners"
              className="flex-shrink-0"
            />
          </div>
        </SectionRow>

        {/* Row 3: Individual Corner Radius (conditional) */}
        {showIndividualCorners && !cornerRadiusDisabled && (
          <SectionRow>
            <div className="grid grid-cols-2 gap-2">
              <ComboInput
                value={cornerRadiusTopLeft}
                onChange={onCornerRadiusTopLeftChange}
                options={cornerRadiusOptions}
                leadIcon={RadiusTopLeft}
                min={0}
                step={1}
                disabled={disabled || cornerRadiusDisabled}
                resetOnClear="0"
              />
              <ComboInput
                value={cornerRadiusTopRight}
                onChange={onCornerRadiusTopRightChange}
                options={cornerRadiusOptions}
                leadIcon={RadiusTopRight}
                min={0}
                step={1}
                disabled={disabled || cornerRadiusDisabled}
                resetOnClear="0"
              />
              <ComboInput
                value={cornerRadiusBottomLeft}
                onChange={onCornerRadiusBottomLeftChange}
                options={cornerRadiusOptions}
                leadIcon={RadiusBottomLeft}
                min={0}
                step={1}
                disabled={disabled || cornerRadiusDisabled}
                resetOnClear="0"
              />
              <ComboInput
                value={cornerRadiusBottomRight}
                onChange={onCornerRadiusBottomRightChange}
                options={cornerRadiusOptions}
                leadIcon={RadiusBottomRight}
                min={0}
                step={1}
                disabled={disabled || cornerRadiusDisabled}
                resetOnClear="0"
              />
            </div>
          </SectionRow>
        )}

        {/* Row 4: Overflow */}
        <SectionRow hasTrailingAction>
          <div className="flex items-end gap-2">
            {!showIndividualOverflow ? (
              <div className="flex-1 min-w-0 flex flex-col">
                <span className={labelClassName}>Overflow</span>
                <Dropdown
                  value={overflow ?? ""}
                  onValueChange={(v) => onOverflowChange(v as OverflowValue)}
                  options={overflowOptions}
                  disabled={disabled}
                  placeholder={overflow ? undefined : "Mixed"}
                />
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className={labelClassName}>Overflow X</span>
                  <Dropdown
                    value={overflowX}
                    onValueChange={(v) => onOverflowXChange(v as OverflowValue)}
                    options={overflowOptions}
                    disabled={disabled}
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className={labelClassName}>Overflow Y</span>
                  <Dropdown
                    value={overflowY}
                    onValueChange={(v) => onOverflowYChange(v as OverflowValue)}
                    options={overflowOptions}
                    disabled={disabled}
                  />
                </div>
              </>
            )}
            <IconButton
              icon={AdjustSmall}
              toggled={showIndividualOverflow}
              onToggle={onShowIndividualOverflowChange}
              disabled={disabled}
              aria-label="Toggle individual overflow axes"
              className="flex-shrink-0"
            />
          </div>
        </SectionRow>
      </SectionBody>
    </SectionWrapper>
  );
}

AppearanceSection.displayName = "AppearanceSection";

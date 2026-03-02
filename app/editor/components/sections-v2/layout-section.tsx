"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SectionWrapper, SectionBody, SectionRow } from "./section-wrapper";
import { SectionHeader } from "../ui/section-header";
import { IconSegmentedControl } from "../ui/segmented-control";
import { AlignmentGridNew, type AlignmentPosition } from "../ui/alignment-grid-new";
import { ComboInput, type ComboInputOption } from "../ui/combo-input";
import { SpacingControl, type SpacingMode, type SpacingSide } from "../ui/spacing-control";
import { parseNumericInput } from "../ui/numeric-validation";
import {
  AlLayoutVertical,
  AlLayoutHorizontal,
  AlLayoutWrap,
  AlSpacingVertical,
  AlSpacingHorizontal,
  LayoutAlignLeft,
  LayoutAlignHorizontalCenter,
  LayoutAlignRight,
} from "@/components/icons/editor";

// ============================================================================
// Types
// ============================================================================

export type FlowDirection = "vertical" | "horizontal" | "wrap";

export interface LayoutSectionProps {
  // Direction
  direction: FlowDirection;
  onDirectionChange: (direction: FlowDirection) => void;

  // Alignment
  alignment: AlignmentPosition;
  onAlignmentChange: (alignment: AlignmentPosition) => void;

  // Space between (justify-content: space-between)
  spaceBetween?: boolean;
  onSpaceBetweenChange?: (spaceBetween: boolean) => void;

  // Gap
  gap: number | undefined;
  onGapChange: (value: number | undefined) => void;

  // Padding
  paddingMode: SpacingMode;
  paddingX: number | undefined;
  paddingY: number | undefined;
  paddingTop: number | undefined;
  paddingRight: number | undefined;
  paddingBottom: number | undefined;
  paddingLeft: number | undefined;
  onPaddingModeChange: (mode: SpacingMode) => void;
  onPaddingChange: (side: SpacingSide, value: number | undefined) => void;
  onPaddingCommaChange?: (axis: "x" | "y", value1: number, value2: number) => void;

  // Margin
  marginMode: SpacingMode;
  marginX: number | undefined;
  marginY: number | undefined;
  marginTop: number | undefined;
  marginRight: number | undefined;
  marginBottom: number | undefined;
  marginLeft: number | undefined;
  onMarginModeChange: (mode: SpacingMode) => void;
  onMarginChange: (side: SpacingSide, value: number | undefined) => void;
  onMarginCommaChange?: (axis: "x" | "y", value1: number, value2: number) => void;

  // Visibility / mode
  alignmentMode?: "grid" | "simple";
  showMargin?: boolean;

  // General
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const directionOptions = [
  { value: "vertical" as const, icon: AlLayoutVertical, label: "Vertical" },
  { value: "horizontal" as const, icon: AlLayoutHorizontal, label: "Horizontal" },
  { value: "wrap" as const, icon: AlLayoutWrap, label: "Wrap" },
];

type SimpleAlignment = "left" | "center" | "right";

const simpleAlignmentOptions = [
  { value: "left" as const, icon: LayoutAlignLeft, label: "Left" },
  { value: "center" as const, icon: LayoutAlignHorizontalCenter, label: "Center" },
  { value: "right" as const, icon: LayoutAlignRight, label: "Right" },
];

// Map between simple alignment values and AlignmentPosition
const simpleToAlignment: Record<SimpleAlignment, AlignmentPosition> = {
  left: "top-left",
  center: "top-center",
  right: "top-right",
};

function alignmentToSimple(alignment: AlignmentPosition): SimpleAlignment {
  if (alignment.endsWith("-center")) return "center";
  if (alignment.endsWith("-right")) return "right";
  return "left";
}

const gapOptions: ComboInputOption[] = [
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
];

// ============================================================================
// Component
// ============================================================================

export function LayoutSection({
  direction,
  onDirectionChange,
  alignment,
  onAlignmentChange,
  spaceBetween,
  onSpaceBetweenChange,
  gap,
  onGapChange,
  paddingMode,
  paddingX,
  paddingY,
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft,
  onPaddingModeChange,
  onPaddingChange,
  onPaddingCommaChange,
  marginMode,
  marginX,
  marginY,
  marginTop,
  marginRight,
  marginBottom,
  marginLeft,
  onMarginModeChange,
  onMarginChange,
  onMarginCommaChange,
  alignmentMode = "grid",
  showMargin = true,
  disabled = false,
  className,
}: LayoutSectionProps) {
  // Determine gap icon based on direction
  const GapIcon = direction === "vertical" ? AlSpacingVertical : AlSpacingHorizontal;

  const handleGapChange = (value: string | undefined) => {
    if (value === undefined || value === "") {
      onGapChange(undefined);
    } else {
      onGapChange(parseNumericInput(value) ?? undefined);
    }
  };

  return (
    <SectionWrapper className={className}>
      <SectionHeader title="Layout" />
      <SectionBody>
        {/* Direction row */}
        <SectionRow>
          <IconSegmentedControl
            options={directionOptions}
            value={direction}
            onValueChange={onDirectionChange}
            disabled={disabled}
            fullWidth
          />
        </SectionRow>

        {/* Alignment + Gap row */}
        <SectionRow>
          {alignmentMode === "simple" ? (
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0 flex flex-col">
                <span className="text-[9px] font-medium leading-4 tracking-[0.045px] text-stone-500 dark:text-stone-400">
                  Alignment
                </span>
                <IconSegmentedControl
                  options={simpleAlignmentOptions}
                  value={alignmentToSimple(alignment)}
                  onValueChange={(v) => onAlignmentChange(simpleToAlignment[v])}
                  disabled={disabled}
                  fullWidth
                />
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <span className="text-[9px] font-medium leading-4 tracking-[0.045px] text-stone-500 dark:text-stone-400">
                  Gap
                </span>
                <ComboInput
                  value={gap !== undefined ? String(gap) : undefined}
                  onChange={handleGapChange}
                  options={gapOptions}
                  leadIcon={GapIcon}
                  disabled={disabled}
                  resetOnClear="0"
                  min={0}
                  step={1}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0 flex flex-col">
                <span className="text-[9px] font-medium leading-4 tracking-[0.045px] text-stone-500 dark:text-stone-400">
                  Alignment
                </span>
                <AlignmentGridNew
                  value={alignment}
                  onChange={onAlignmentChange}
                  flow={direction === "vertical" ? "vertical" : "horizontal"}
                  spaceBetween={spaceBetween}
                  onSpaceBetweenChange={onSpaceBetweenChange}
                  disabled={disabled}
                />
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <span className="text-[9px] font-medium leading-4 tracking-[0.045px] text-stone-500 dark:text-stone-400">
                  Gap
                </span>
                <ComboInput
                  value={gap !== undefined ? String(gap) : undefined}
                  onChange={handleGapChange}
                  options={gapOptions}
                  leadIcon={GapIcon}
                  disabled={disabled}
                  resetOnClear="0"
                  min={0}
                  step={1}
                />
              </div>
            </div>
          )}
        </SectionRow>

        {/* Padding */}
        <SectionRow hasTrailingAction>
          <div className="flex flex-col w-full">
            <span className="text-[9px] font-medium leading-4 tracking-[0.045px] text-stone-500 dark:text-stone-400">
              Padding
            </span>
            <SpacingControl
              mode={paddingMode}
              onModeChange={onPaddingModeChange}
              x={paddingX}
              y={paddingY}
              top={paddingTop}
              right={paddingRight}
              bottom={paddingBottom}
              left={paddingLeft}
              onChange={onPaddingChange}
              onCommaChange={onPaddingCommaChange}
              disabled={disabled}
              resetOnClear="0"
            />
          </div>
        </SectionRow>

        {/* Margin */}
        {showMargin && (
          <SectionRow hasTrailingAction>
            <div className="flex flex-col w-full">
              <span className="text-[9px] font-medium leading-4 tracking-[0.045px] text-stone-500 dark:text-stone-400">
                Margin
              </span>
              <SpacingControl
                mode={marginMode}
                onModeChange={onMarginModeChange}
                x={marginX}
                y={marginY}
                top={marginTop}
                right={marginRight}
                bottom={marginBottom}
                left={marginLeft}
                onChange={onMarginChange}
                onCommaChange={onMarginCommaChange}
                disabled={disabled}
                resetOnClear="0"
              />
            </div>
          </SectionRow>
        )}

      </SectionBody>
    </SectionWrapper>
  );
}

LayoutSection.displayName = "LayoutSection";

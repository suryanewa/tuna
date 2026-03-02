"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SectionWrapper, SectionBody, SectionRow } from "./section-wrapper";
import { SectionHeader } from "../ui/section-header";
import { Dropdown, type DropdownOption } from "../ui/dropdown";
import { ConstraintsInput } from "../ui/constraints-input";
import { NumberInput } from "../ui/number-input";
import { ButtonGroup, type ButtonGroupItem } from "../ui/button-group";
import {
  Rotation,
  Rotate,
  FlipHorizontalSmall,
  FlipVertical,
  LayoutAlignLeft,
  LayoutAlignHorizontalCenter,
  LayoutAlignRight,
  LayoutAlignTop,
  LayoutAlignVerticalCenter,
  LayoutAlignBottom,
} from "@/components/icons/editor";

export type PositionType = "static" | "relative" | "absolute" | "fixed" | "sticky";

export interface PinState {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

export type StickyEdge = "top" | "right" | "bottom" | "left";

export interface PositionSectionProps {
  // Position type
  positionType?: PositionType;
  onPositionTypeChange: (type: PositionType) => void;

  // Constraints (T/R/B/L values)
  top: number | undefined;
  right: number | undefined;
  bottom: number | undefined;
  left: number | undefined;
  onConstraintChange: (
    side: "top" | "right" | "bottom" | "left",
    value: number | undefined
  ) => void;

  // Pin state
  pins: PinState;
  onPinChange: (side: "top" | "right" | "bottom" | "left", pinned: boolean) => void;

  // Center state
  centered?: boolean;
  onCenterChange?: (centered: boolean) => void;

  // Sticky position
  stickyEdge?: StickyEdge;
  stickyValue?: number;
  onStickyEdgeChange?: (edge: StickyEdge) => void;
  onStickyValueChange?: (value: number | undefined) => void;

  // Rotation
  rotation: number;
  onRotationChange: (value: number) => void;

  // Transform actions
  onRotate90?: () => void;
  onFlipHorizontal?: () => void;
  onFlipVertical?: () => void;

  // Alignment (enabled when absolute/fixed)
  onAlignLeft?: () => void;
  onAlignCenterH?: () => void;
  onAlignRight?: () => void;
  onAlignTop?: () => void;
  onAlignCenterV?: () => void;
  onAlignBottom?: () => void;
  alignmentEnabled?: boolean;

  // General
  disabled?: boolean;
  className?: string;
}

const positionOptions: DropdownOption[] = [
  { value: "static", label: "Static" },
  { value: "relative", label: "Relative" },
  { value: "absolute", label: "Absolute" },
  { value: "fixed", label: "Fixed" },
  { value: "sticky", label: "Sticky" },
];

const stickyEdgeOptions: DropdownOption[] = [
  { value: "top", label: "Top" },
  { value: "right", label: "Right" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
];

export function PositionSection({
  positionType,
  onPositionTypeChange,
  top,
  right,
  bottom,
  left,
  onConstraintChange,
  pins,
  onPinChange,
  centered = false,
  onCenterChange,
  stickyEdge = "top",
  stickyValue = 0,
  onStickyEdgeChange,
  onStickyValueChange,
  rotation,
  onRotationChange,
  onRotate90,
  onFlipHorizontal,
  onFlipVertical,
  onAlignLeft,
  onAlignCenterH,
  onAlignRight,
  onAlignTop,
  onAlignCenterV,
  onAlignBottom,
  alignmentEnabled = false,
  disabled = false,
  className,
}: PositionSectionProps) {
  // Local state for rotation input to handle degree symbol properly
  const [rotationInput, setRotationInput] = React.useState(`${rotation}°`);
  const [isEditingRotation, setIsEditingRotation] = React.useState(false);

  // Derive display value: show prop when not editing, local state when editing
  const rotationDisplay = isEditingRotation ? rotationInput : `${rotation}°`;

  const handleRotationInputChange = (value: string | undefined) => {
    setIsEditingRotation(true);
    setRotationInput(value ?? "");
    // Update canvas in real time as the user types
    const cleaned = (value ?? "").replace(/°/g, "").trim();
    const numValue = Number(cleaned);
    if (cleaned !== "" && !isNaN(numValue)) {
      onRotationChange(numValue);
    }
  };

  const handleRotationBlur = (value: string | undefined) => {
    setIsEditingRotation(false);
    // Strip degree symbol and parse the number
    const cleaned = (value ?? "").replace(/°/g, "").trim();
    const numValue = cleaned === "" ? 0 : Number(cleaned);
    const finalValue = isNaN(numValue) ? rotation : numValue;
    onRotationChange(finalValue);
    // Re-format with degree symbol
    setRotationInput(`${finalValue}°`);
  };

  const transformButtons: ButtonGroupItem[] = [
    {
      icon: Rotate,
      onClick: onRotate90,
      label: "Rotate 90 degrees",
      disabled: disabled || !onRotate90,
    },
    {
      icon: FlipHorizontalSmall,
      onClick: onFlipHorizontal,
      label: "Flip horizontal",
      disabled: disabled || !onFlipHorizontal,
    },
    {
      icon: FlipVertical,
      onClick: onFlipVertical,
      label: "Flip vertical",
      disabled: disabled || !onFlipVertical,
    },
  ];

  return (
    <SectionWrapper className={className}>
      <SectionHeader title="Position" />
      <SectionBody>
        {/* Alignment */}
        <SectionRow>
          <div className="flex flex-col">
            <span className="text-[9px] font-medium leading-4 tracking-[0.045px] text-stone-500 dark:text-stone-400">
              Alignment
            </span>
            <div className="flex gap-1">
              <ButtonGroup
                items={[
                  { icon: LayoutAlignLeft, label: "Align left", onClick: onAlignLeft, disabled: !alignmentEnabled },
                  { icon: LayoutAlignHorizontalCenter, label: "Align center", onClick: onAlignCenterH, disabled: !alignmentEnabled },
                  { icon: LayoutAlignRight, label: "Align right", onClick: onAlignRight, disabled: !alignmentEnabled },
                ]}
                disabled={disabled}
              />
              <ButtonGroup
                items={[
                  { icon: LayoutAlignTop, label: "Align top", onClick: onAlignTop, disabled: !alignmentEnabled },
                  { icon: LayoutAlignVerticalCenter, label: "Align middle", onClick: onAlignCenterV, disabled: !alignmentEnabled },
                  { icon: LayoutAlignBottom, label: "Align bottom", onClick: onAlignBottom, disabled: !alignmentEnabled },
                ]}
                disabled={disabled}
              />
            </div>
          </div>
        </SectionRow>

        {/* Position type dropdown */}
        <SectionRow>
          <Dropdown
            value={positionType ?? ""}
            onValueChange={(v) => onPositionTypeChange(v as PositionType)}
            options={positionOptions}
            disabled={disabled}
            placeholder={positionType ? undefined : "Mixed"}
          />
        </SectionRow>

        {/* Constraints input - for absolute and fixed */}
        {(positionType === "absolute" || positionType === "fixed") && (
          <SectionRow>
            <ConstraintsInput
              top={top}
              right={right}
              bottom={bottom}
              left={left}
              pinned={pins}
              centered={centered}
              onChange={onConstraintChange}
              onPinChange={onPinChange}
              onCenterChange={onCenterChange}
              disabled={disabled}
            />
          </SectionRow>
        )}

        {/* Sticky position - edge dropdown and value input */}
        {positionType === "sticky" && (
          <SectionRow>
            <div className="flex items-center gap-2">
              <Dropdown
                value={stickyEdge}
                onValueChange={(v) => onStickyEdgeChange?.(v as StickyEdge)}
                options={stickyEdgeOptions}
                disabled={disabled}
                className="w-[100px]"
              />
              <NumberInput
                value={stickyValue}
                onChange={(v) => {
                  const num = v ? parseInt(v) : undefined;
                  onStickyValueChange?.(num);
                }}
                disabled={disabled}
                className="flex-1"
              />
            </div>
          </SectionRow>
        )}

        {/* Rotation row */}
        <SectionRow>
          <div className="flex flex-col">
            <span
              className={cn(
                "text-[9px] font-medium leading-4 tracking-[0.045px] text-stone-500 dark:text-stone-400"
              )}
            >
              Rotation
            </span>
            <div className="flex items-center gap-2">
              <NumberInput
                value={rotationDisplay}
                onChange={handleRotationInputChange}
                onBlur={handleRotationBlur}
                leadIcon={Rotation}
                min={-180}
                max={180}
                disabled={disabled}
                className="flex-1"
              />
              <ButtonGroup items={transformButtons} disabled={disabled} />
            </div>
          </div>
        </SectionRow>
      </SectionBody>
    </SectionWrapper>
  );
}

PositionSection.displayName = "PositionSection";

"use client";

import * as React from "react";
import { SectionWrapper, SectionBody, SectionRow } from "./section-wrapper";
import { SectionHeader } from "../ui/section-header";
import { NumberInput } from "../ui/number-input";
import { ColorInput } from "../ui/color-input";
import { Dropdown } from "../ui/dropdown";
import { IconButton } from "../ui/icon-button";
import { ColorPickerDialog } from "../color-picker-dialog";
import {
  PlusSmall,
  MinusSmall,
  StrokeWeight,
  StrokeSolid,
  StrokeDash,
  BorderSmall,
  BorderTopSmall,
  BorderBottomSmall,
  BorderLeftSmall,
  BorderRightSmall,
} from "@/components/icons/editor";

// ============================================================================
// Types
// ============================================================================

export type BorderStyle = "solid" | "dashed";
export type BorderSide = "all" | "top" | "bottom" | "left" | "right";

export interface BorderValue {
  color: string;
  opacity: number;
  width: number;
  style: BorderStyle;
  side: BorderSide;
}

export interface BorderSectionProps {
  border: BorderValue | null;
  onBorderChange: (border: BorderValue | null) => void;
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_BORDER: BorderValue = {
  color: "#000000",
  opacity: 100,
  width: 1,
  style: "solid",
  side: "all",
};

const BORDER_STYLE_OPTIONS = [
  { value: "solid" as const, label: "Solid" },
  { value: "dashed" as const, label: "Dashed" },
];

const BORDER_SIDE_MENU_ITEMS = [
  { value: "all", label: "All" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

const SIDE_ICON_MAP: Record<
  BorderSide,
  React.ComponentType<{ className?: string }>
> = {
  all: BorderSmall,
  top: BorderTopSmall,
  bottom: BorderBottomSmall,
  left: BorderLeftSmall,
  right: BorderRightSmall,
};

// ============================================================================
// Component
// ============================================================================

export function BorderSection({
  border,
  onBorderChange,
  disabled = false,
  className,
}: BorderSectionProps) {
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const handleAddBorder = () => {
    onBorderChange({ ...DEFAULT_BORDER });
  };

  const handleRemoveBorder = () => {
    setPickerOpen(false);
    onBorderChange(null);
  };

  const handleWidthChange = (value: string | undefined) => {
    if (!border) return;
    const num = value === undefined ? 0 : parseFloat(value) || 0;
    onBorderChange({ ...border, width: Math.max(0, num) });
  };

  const handleStyleChange = (value: string) => {
    if (!border) return;
    onBorderChange({ ...border, style: value as BorderStyle });
  };

  const handleSideSelect = (item: { value: string }) => {
    if (!border) return;
    onBorderChange({ ...border, side: item.value as BorderSide });
  };

  return (
    <SectionWrapper className={className}>
      <SectionHeader
        title="Border"
        isEmpty={!border}
        iconButton={
          !border
            ? {
                icon: PlusSmall,
                onClick: handleAddBorder,
                "aria-label": "Add border",
              }
            : undefined
        }
      />
      {border && (
        <SectionBody>
          {/* Row 1: Color + Opacity + Remove button */}
          <SectionRow hasTrailingAction>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <ColorPickerDialog
                  open={pickerOpen}
                  onOpenChange={setPickerOpen}
                  trigger={
                    <ColorInput
                      value={border.color}
                      onChange={(color) => onBorderChange({ ...border, color })}
                      opacity={border.opacity}
                      onOpacityChange={(opacity) => onBorderChange({ ...border, opacity })}
                      disabled={disabled}
                    />
                  }
                  value={border.color}
                  onChange={(color) => onBorderChange({ ...border, color })}
                  opacity={border.opacity}
                  onOpacityChange={(opacity) => onBorderChange({ ...border, opacity })}
                  showOptions={false}
                  prefix="border"
                />
              </div>
              <IconButton
                icon={MinusSmall}
                onClick={handleRemoveBorder}
                disabled={disabled}
                aria-label="Remove border"
                className="flex-shrink-0"
              />
            </div>
          </SectionRow>

          {/* Row 2: Width + Style + Side */}
          <SectionRow hasTrailingAction>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <NumberInput
                  value={String(border.width)}
                  onChange={handleWidthChange}
                  leadIcon={StrokeWeight}
                  min={0}
                  disabled={disabled}
                />
              </div>
              <div className="flex-1 min-w-0">
                <Dropdown
                  value={border.style}
                  onValueChange={handleStyleChange}
                  options={BORDER_STYLE_OPTIONS}
                  leadIcon={
                    border.style === "solid" ? StrokeSolid : StrokeDash
                  }
                  disabled={disabled}
                />
              </div>
              <IconButton
                icon={SIDE_ICON_MAP[border.side]}
                menuItems={BORDER_SIDE_MENU_ITEMS}
                onMenuSelect={handleSideSelect}
                menuValue={border.side}
                disabled={disabled}
                aria-label="Border side"
                className="flex-shrink-0"
              />
            </div>
          </SectionRow>
        </SectionBody>
      )}
    </SectionWrapper>
  );
}

BorderSection.displayName = "BorderSection";

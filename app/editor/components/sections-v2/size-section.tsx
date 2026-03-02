"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SectionWrapper, SectionBody, SectionRow } from "./section-wrapper";
import { SectionHeader } from "../ui/section-header";
import { ComboInput, type ComboInputOption } from "../ui/combo-input";
import { IconButton } from "../ui/icon-button";
import { type DropdownMenuOption } from "../ui/dropdown-menu";
import {
  PlusSmall,
  MinusSmall,
  AlWidthMin,
  AlHeightMin,
  AlWidthMax,
  AlHeightMax,
} from "@/components/icons/editor";

// ============================================================================
// Types
// ============================================================================

export interface SizeSectionProps {
  // Width & Height (always visible)
  width: string | undefined;
  onWidthChange: (value: string | undefined) => void;
  height: string | undefined;
  onHeightChange: (value: string | undefined) => void;

  // Min Width & Min Height (optional row)
  showMinSize?: boolean;
  onShowMinSizeChange?: (show: boolean) => void;
  minWidth: string | undefined;
  onMinWidthChange: (value: string | undefined) => void;
  minHeight: string | undefined;
  onMinHeightChange: (value: string | undefined) => void;

  // Max Width & Max Height (optional row)
  showMaxSize?: boolean;
  onShowMaxSizeChange?: (show: boolean) => void;
  maxWidth: string | undefined;
  onMaxWidthChange: (value: string | undefined) => void;
  maxHeight: string | undefined;
  onMaxHeightChange: (value: string | undefined) => void;

  // General
  disabled?: boolean;
  className?: string;
  /** When set, undefined values show this as placeholder (e.g. "Mixed" for multi-select) */
  mixedPlaceholder?: string;
  /** Hide specific size options from the dropdown (e.g. ["fill", "viewport"] for canvas elements) */
  hiddenOptions?: string[];
}

// ============================================================================
// Constants
// ============================================================================

const sizeOptions: ComboInputOption[] = [
  { value: "auto", label: "Auto" },
  { value: "fill", label: "Fill" },
  { value: "hug", label: "Hug" },
  { value: "viewport", label: "Viewport" },
  { value: "100", label: "100" },
  { value: "200", label: "200" },
  { value: "300", label: "300" },
  { value: "400", label: "400" },
  { value: "500", label: "500" },
  { value: "600", label: "600" },
  { value: "800", label: "800" },
  { value: "1000", label: "1000" },
  { value: "1200", label: "1200" },
];

const minSizeOptions: ComboInputOption[] = [
  { value: "0", label: "0" },
  { value: "100", label: "100" },
  { value: "200", label: "200" },
  { value: "300", label: "300" },
  { value: "400", label: "400" },
  { value: "500", label: "500" },
];

const maxSizeOptions: ComboInputOption[] = [
  { value: "200", label: "200" },
  { value: "400", label: "400" },
  { value: "600", label: "600" },
  { value: "800", label: "800" },
  { value: "1000", label: "1000" },
  { value: "1200", label: "1200" },
];

const labelClassName = "text-[9px] font-medium leading-4 tracking-[0.045px] text-stone-500 dark:text-stone-400";

// ============================================================================
// Component
// ============================================================================

export function SizeSection({
  width,
  onWidthChange,
  height,
  onHeightChange,
  showMinSize = false,
  onShowMinSizeChange,
  minWidth,
  onMinWidthChange,
  minHeight,
  onMinHeightChange,
  showMaxSize = false,
  onShowMaxSizeChange,
  maxWidth,
  onMaxWidthChange,
  maxHeight,
  onMaxHeightChange,
  disabled = false,
  className,
  mixedPlaceholder,
  hiddenOptions,
}: SizeSectionProps) {
  const filteredSizeOptions = hiddenOptions
    ? sizeOptions.filter(o => !hiddenOptions.includes(o.value))
    : sizeOptions;

  // Build menu items — only include options that haven't been added yet
  const menuItems: DropdownMenuOption[] = [
    ...(!showMinSize ? [{ value: "add-min", label: "Add Min Width/Height" }] : []),
    ...(!showMaxSize ? [{ value: "add-max", label: "Add Max Width/Height" }] : []),
  ];

  // Hide the icon button entirely when both are added
  const allAdded = showMinSize && showMaxSize;

  const handleMenuSelect = (item: DropdownMenuOption) => {
    if (item.value === "add-min") {
      onShowMinSizeChange?.(true);
    } else if (item.value === "add-max") {
      onShowMaxSizeChange?.(true);
    }
  };

  const handleRemoveMin = () => {
    onMinWidthChange(undefined);
    onMinHeightChange(undefined);
    onShowMinSizeChange?.(false);
  };

  const handleRemoveMax = () => {
    onMaxWidthChange(undefined);
    onMaxHeightChange(undefined);
    onShowMaxSizeChange?.(false);
  };

  return (
    <SectionWrapper className={className}>
      <SectionHeader
        title="Size"
        iconButton={
          !allAdded
            ? {
                icon: PlusSmall,
                menuItems,
                onMenuSelect: handleMenuSelect,
                "aria-label": "Add size constraint",
              }
            : undefined
        }
      />
      <SectionBody>
        {/* Row 1: Width + Height (always visible, height can be hidden for line elements) */}
        <SectionRow>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0 flex flex-col">
              <span className={labelClassName}>Width</span>
              <ComboInput
                value={width}
                onChange={onWidthChange}
                options={filteredSizeOptions}
                property="W"
                disabled={disabled}
                resetOnClear="auto"
                min={0}
                step={1}
                placeholder={width === undefined && mixedPlaceholder ? mixedPlaceholder : undefined}
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <span className={labelClassName}>Height</span>
              <ComboInput
                value={height}
                onChange={onHeightChange}
                options={filteredSizeOptions}
                property="H"
                disabled={disabled}
                resetOnClear="auto"
                min={0}
                step={1}
                placeholder={height === undefined && mixedPlaceholder ? mixedPlaceholder : undefined}
              />
            </div>
          </div>
        </SectionRow>

        {/* Row 2: Min Width + Min Height (conditional) */}
        {showMinSize && (
          <SectionRow hasTrailingAction>
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0 flex flex-col">
                <span className={labelClassName}>Min Width</span>
                <ComboInput
                  value={minWidth}
                  onChange={onMinWidthChange}
                  options={minSizeOptions}
                  leadIcon={AlWidthMin}
                  disabled={disabled}
                  placeholder="Min W"
                  min={0}
                  step={1}
                />
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <span className={labelClassName}>Min Height</span>
                <ComboInput
                  value={minHeight}
                  onChange={onMinHeightChange}
                  options={minSizeOptions}
                  leadIcon={AlHeightMin}
                  disabled={disabled}
                  placeholder="Min H"
                  min={0}
                  step={1}
                />
              </div>
              <IconButton
                icon={MinusSmall}
                onClick={handleRemoveMin}
                disabled={disabled}
                aria-label="Remove min size"
                className="flex-shrink-0"
              />
            </div>
          </SectionRow>
        )}

        {/* Row 3: Max Width + Max Height (conditional) */}
        {showMaxSize && (
          <SectionRow hasTrailingAction>
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0 flex flex-col">
                <span className={labelClassName}>Max Width</span>
                <ComboInput
                  value={maxWidth}
                  onChange={onMaxWidthChange}
                  options={maxSizeOptions}
                  leadIcon={AlWidthMax}
                  disabled={disabled}
                  placeholder="Max W"
                  min={0}
                  step={1}
                />
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <span className={labelClassName}>Max Height</span>
                <ComboInput
                  value={maxHeight}
                  onChange={onMaxHeightChange}
                  options={maxSizeOptions}
                  leadIcon={AlHeightMax}
                  disabled={disabled}
                  placeholder="Max H"
                  min={0}
                  step={1}
                />
              </div>
              <IconButton
                icon={MinusSmall}
                onClick={handleRemoveMax}
                disabled={disabled}
                aria-label="Remove max size"
                className="flex-shrink-0"
              />
            </div>
          </SectionRow>
        )}
      </SectionBody>
    </SectionWrapper>
  );
}

SizeSection.displayName = "SizeSection";

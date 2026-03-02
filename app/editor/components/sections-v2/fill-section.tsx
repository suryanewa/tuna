"use client";

import * as React from "react";
import { SectionWrapper, SortableBody, SortableRow } from "./section-wrapper";
import { SectionHeader } from "../ui/section-header";
import { ColorInput } from "../ui/color-input";
import type { GradientFill } from "../ui/color-input";
import { ColorPickerDialog } from "../color-picker-dialog";
import { IconButton } from "../ui/icon-button";
import { PlusSmall, MinusSmall, EyeSmall, HiddenSmall } from "@/components/icons/editor";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export type { GradientFill, GradientStop } from "../ui/color-input";

export interface FillItem {
  id: string;
  color: string;
  opacity: number;
  visible?: boolean;
  gradient?: GradientFill;
}

export interface FillSectionProps {
  fills: FillItem[];
  onFillsChange: (fills: FillItem[]) => void;
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function FillSection({
  fills,
  onFillsChange,
  disabled = false,
  className,
}: FillSectionProps) {
  const [openPickerIndex, setOpenPickerIndex] = React.useState(-1);

  const handleAdd = () => {
    const newFill: FillItem =
      fills.length === 0
        ? { id: crypto.randomUUID(), color: "#ffffff", opacity: 100, visible: true }
        : { id: crypto.randomUUID(), color: "#000000", opacity: 20, visible: true };
    onFillsChange([newFill, ...fills]);
  };

  const handleColorChange = (index: number, color: string) => {
    const updated = fills.map((f, i) =>
      i === index ? { ...f, color, visible: true } : f
    );
    onFillsChange(updated);
  };

  const handleOpacityChange = (index: number, opacity: number) => {
    const updated = fills.map((f, i) =>
      i === index ? { ...f, opacity, visible: true } : f
    );
    onFillsChange(updated);
  };

  const handleGradientChange = (index: number, gradient: GradientFill | undefined) => {
    const updated = fills.map((f, i) =>
      i === index ? { ...f, gradient } : f
    );
    onFillsChange(updated);
  };

  const handleVisibilityToggle = (index: number) => {
    const updated = fills.map((f, i) =>
      i === index ? { ...f, visible: f.visible === false ? true : false } : f
    );
    onFillsChange(updated);
  };

  const handleRemove = (index: number) => {
    setOpenPickerIndex(-1);
    onFillsChange(fills.filter((_, i) => i !== index));
  };

  return (
    <SectionWrapper className={className}>
      <SectionHeader
        title="Fill"
        isEmpty={fills.length === 0}
        iconButton={{
          icon: PlusSmall,
          onClick: handleAdd,
          "aria-label": "Add fill",
        }}
      />
      {fills.length > 0 && (
        <SortableBody values={fills} onReorder={onFillsChange}>
          {fills.map((fill, index) => (
            <SortableRow key={fill.id} index={index} hasTrailingAction disabled={disabled}>
              <div className="flex items-center gap-2">
                <div className={cn("flex-1 min-w-0", fill.visible === false && "opacity-50")}>
                  <ColorPickerDialog
                    open={openPickerIndex === index}
                    onOpenChange={(open) => setOpenPickerIndex(open ? index : -1)}
                    trigger={
                      <ColorInput
                        value={fill.color}
                        onChange={(color) => handleColorChange(index, color)}
                        opacity={fill.opacity}
                        onOpacityChange={(opacity) => handleOpacityChange(index, opacity)}
                        gradient={fill.gradient}
                        disabled={disabled}
                      />
                    }
                    value={fill.color}
                    onChange={(color) => handleColorChange(index, color)}
                    opacity={fill.opacity}
                    onOpacityChange={(opacity) => handleOpacityChange(index, opacity)}
                    gradient={fill.gradient}
                    onGradientChange={(gradient) => handleGradientChange(index, gradient)}
                    showOptions={true}
                    prefix="bg"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <IconButton
                    icon={fill.visible === false ? HiddenSmall : EyeSmall}
                    toggled={fill.visible === false}
                    onToggle={() => handleVisibilityToggle(index)}
                    disabled={disabled}
                    aria-label="Toggle fill visibility"
                  />
                  <IconButton
                    icon={MinusSmall}
                    onClick={() => handleRemove(index)}
                    disabled={disabled}
                    aria-label="Remove fill"
                  />
                </div>
              </div>
            </SortableRow>
          ))}
        </SortableBody>
      )}
    </SectionWrapper>
  );
}

FillSection.displayName = "FillSection";

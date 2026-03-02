"use client";

import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label?: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value?: T;
  onValueChange: (value: T) => void;
  /** Called when hovering over an option (value) or leaving (null). Useful for live previews. */
  onOptionHover?: (value: T | null) => void;
  disabled?: boolean;
  className?: string;
  /** Variant affects sizing - "icon" for icon-only, "label" for text labels */
  variant?: "icon" | "label";
  /** Whether to fill the available width */
  fullWidth?: boolean;
  /** Compact mode: 24px icon items without flex growth */
  compact?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onValueChange,
  onOptionHover,
  disabled = false,
  className,
  variant = "icon",
  fullWidth = false,
  compact = false,
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value ?? ""}
      onValueChange={(newValue) => {
        // Radix sends empty string when clicking already selected item
        // We want to keep the selection, so only update if there's a value
        if (newValue) {
          onValueChange(newValue as T);
        }
      }}
      disabled={disabled}
      className={cn(
        // Container: light gray background, rounded, fixed 24px height
        "items-center bg-stone-100 dark:bg-stone-800 rounded-input overflow-hidden h-6",
        fullWidth ? "flex w-full" : "inline-flex",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      {options.map((option) => {
        const isSelected = value === option.value;
        const Icon = option.icon;
        const isIconVariant = variant === "icon" || (!option.label && Icon);

        return (
          <ToggleGroupPrimitive.Item
            key={option.value}
            value={option.value}
            disabled={option.disabled || disabled}
            onMouseEnter={() => onOptionHover?.(option.value)}
            onMouseLeave={() => onOptionHover?.(null)}
            className={cn(
              // Base styles - segments are flush, no gap
              "relative flex items-center justify-center transition-all",
              !compact && "flex-1",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              // Fixed 24px height for all segments
              "h-6",
              isIconVariant
                ? compact ? "w-6" : "w-8" // 24px compact, 32px default
                : "px-3 text-xs",          // Horizontal padding for labels
              // All items have border for consistent sizing
              "border rounded-input",
              // Selected state: background color with visible border
              isSelected
                ? "bg-background border-border"
                : "border-transparent text-muted-foreground hover:text-foreground",
              // Disabled state for individual items
              option.disabled && "opacity-40 pointer-events-none"
            )}
          >
            {Icon && (
              <Icon
                className={cn(
                  // Icons always 24x24
                  "w-6 h-6",
                  isSelected ? "text-foreground" : "text-muted-foreground"
                )}
              />
            )}
            {option.label && !isIconVariant && (
              <span
                className={cn(
                  "font-medium whitespace-nowrap leading-none",
                  isSelected ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {option.label}
              </span>
            )}
          </ToggleGroupPrimitive.Item>
        );
      })}
    </ToggleGroupPrimitive.Root>
  );
}

// ============================================================================
// Convenience exports for common use cases
// ============================================================================

export interface IconSegmentedControlProps<T extends string = string>
  extends Omit<SegmentedControlProps<T>, "variant"> {
  options: Array<{
    value: T;
    icon: React.ComponentType<{ className?: string }>;
    label?: string; // Used for tooltip/aria-label
    disabled?: boolean;
  }>;
  /** Whether to fill the available width */
  fullWidth?: boolean;
}

export function IconSegmentedControl<T extends string = string>(
  props: IconSegmentedControlProps<T>
) {
  return <SegmentedControl {...props} variant="icon" />;
}

export interface LabelSegmentedControlProps<T extends string = string>
  extends Omit<SegmentedControlProps<T>, "variant"> {
  options: Array<{
    value: T;
    label: string;
    disabled?: boolean;
  }>;
}

export function LabelSegmentedControl<T extends string = string>(
  props: LabelSegmentedControlProps<T>
) {
  return <SegmentedControl {...props} variant="label" />;
}

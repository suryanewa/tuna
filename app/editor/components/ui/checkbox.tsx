"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check16 } from "@/components/icons/editor-16";

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ checked, onCheckedChange, label, disabled, className }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);

    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={cn(
          "flex items-center gap-2",
          "focus-visible:outline-none",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        {/* Checkbox box */}
        <div
          className={cn(
            "w-4 h-4 rounded-[5px] flex items-center justify-center",
            "bg-stone-100 dark:bg-stone-800",
            "transition-colors duration-150"
          )}
          style={isFocused ? { outline: "1px solid black", outlineOffset: "-1px" } : undefined}
        >
          {checked && (
            <Check16 className="text-stone-900 dark:text-stone-100" />
          )}
        </div>

        {/* Label */}
        {label && (
          <span
            className={cn(
              "text-[11px] font-medium leading-4 tracking-[0.055px]",
              "text-stone-900 dark:text-stone-100",
              "whitespace-nowrap overflow-hidden text-ellipsis"
            )}
          >
            {label}
          </span>
        )}
      </button>
    );
  }
);

Checkbox.displayName = "Checkbox";

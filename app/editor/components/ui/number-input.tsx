"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useScrub, EW_RESIZE_CURSOR } from "@/app/editor/hooks/useScrub";

export interface NumberInputProps {
  value: string | number | undefined;
  onChange: (value: string | undefined) => void;
  onBlur?: (value: string | undefined) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  property?: string;
  /** Value to reset to when input is cleared and blurred (Figma behavior) */
  resetOnClear?: string;
  leadIcon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      value,
      onChange,
      onBlur,
      unit,
      min,
      max,
      step = 1,
      placeholder,
      property,
      resetOnClear,
      leadIcon: LeadIcon,
      disabled = false,
      className,
      inputClassName,
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const displayValue = value === undefined || value === "" ? "" : String(value);
    const hasLeadElement = LeadIcon || property;

    const { scrubProps, isScrubbing } = useScrub({
      value,
      onChange,
      onBlur,
      step,
      min,
      max,
      disabled: disabled || !hasLeadElement,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      if (newValue === "") {
        onChange(undefined);
      } else {
        onChange(newValue);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const currentValue = parseFloat(displayValue) || 0;
        const delta = e.key === "ArrowUp" ? step : -step;
        const precision =
          step < 1
            ? Math.max(0, -Math.floor(Math.log10(step)))
            : 0;
        let newValue = Number((currentValue + delta).toFixed(precision));

        if (min !== undefined) newValue = Math.max(min, newValue);
        if (max !== undefined) newValue = Math.min(max, newValue);

        onChange(String(newValue));
      }
    };

    return (
      <div
        className={cn("group/numberinput relative flex items-center w-full rounded-input", className)}
        style={isFocused ? { outline: "1px solid black", outlineOffset: "-1px" } : undefined}
        onFocusCapture={() => setIsFocused(true)}
        onBlurCapture={() => {
          setIsFocused(false);
          if (displayValue === "" && resetOnClear !== undefined) {
            onChange(resetOnClear);
            onBlur?.(resetOnClear);
          } else {
            onBlur?.(displayValue === "" ? undefined : displayValue);
          }
        }}
      >
        {hasLeadElement && (
          <div
            {...scrubProps}
            style={disabled ? undefined : { cursor: EW_RESIZE_CURSOR }}
            className="absolute left-0 w-6 h-6 flex items-center justify-center z-[1]"
          >
            {LeadIcon ? (
              <LeadIcon className="w-6 h-6 text-stone-900 dark:text-stone-100 pointer-events-none" />
            ) : (
              <span className="text-[11px] font-[450] tracking-[-0.055px] text-stone-500 dark:text-stone-400 pointer-events-none">
                {property}
              </span>
            )}
          </div>
        )}
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={(e) => e.target.select()}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full h-6 pr-1.5 text-[11px] font-[450] tracking-[-0.055px] bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 border-0 rounded-input",
            "focus-visible:outline-none",
            "group-hover/numberinput:bg-stone-200 dark:group-hover/numberinput:bg-stone-700 transition-colors duration-150",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            isScrubbing && "!bg-stone-200 dark:!bg-stone-700 !transition-none",
            hasLeadElement ? "pl-6" : "pl-1.5",
            unit && "pr-6",
            inputClassName
          )}
        />
        {unit && (
          <span className="absolute right-[8px] text-[10px] tracking-[-0.055px] text-stone-500 dark:text-stone-400 pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    );
  }
);

NumberInput.displayName = "NumberInput";

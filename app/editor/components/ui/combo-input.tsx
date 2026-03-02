"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverAnchor, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from "@/components/icons/editor";
import { DropdownMenu } from "./dropdown-menu";
import { useScrub, EW_RESIZE_CURSOR } from "@/app/editor/hooks/useScrub";
import { clampNumericValue } from "./numeric-validation";

export interface ComboInputOption {
  value: string;
  label: string;
}

export interface ComboInputProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  options: ComboInputOption[];
  leadIcon?: React.ComponentType<{ className?: string }>;
  property?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowCustom?: boolean;
  /** Menu width: "trigger" to match input, "auto" for content, or number for pixels */
  menuWidth?: "trigger" | "auto" | number;
  min?: number;
  max?: number;
  step?: number;
  onBlur?: (value: string | undefined) => void;
  /** Value to reset to when input is cleared and blurred (Figma behavior) */
  resetOnClear?: string;
  /** Numeric start value when `value` is non-numeric (e.g. "auto"). */
  resolvedValue?: number;
  /** Separate value used to match the selected option for checkmark display.
   *  Useful when `value` shows a display label but option values differ (e.g. internal links). */
  selectedValue?: string;
}

export const ComboInput = React.forwardRef<HTMLInputElement, ComboInputProps>(
  (
    {
      value,
      onChange,
      options,
      leadIcon: LeadIcon,
      property,
      placeholder = "",
      disabled = false,
      className,
      allowCustom = true,
      menuWidth = "trigger",
      min,
      max,
      step,
      onBlur,
      resetOnClear,
      resolvedValue,
      selectedValue,
    },
    ref
  ) => {
    const hasLeadElement = LeadIcon || property;
    const scrubEnabled = hasLeadElement && (min !== undefined || max !== undefined || step !== undefined);

    const { scrubProps, isScrubbing } = useScrub({
      value,
      onChange,
      onBlur,
      step,
      min,
      max,
      resolvedValue,
      disabled: disabled || !scrubEnabled,
    });
    const [open, setOpen] = React.useState(false);
    const [inputValue, setInputValue] = React.useState(() => {
      if (!value) return "";
      const match = options.find((opt) => opt.value === value);
      return match ? match.label : value;
    });
    const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
    const [inputFocused, setInputFocused] = React.useState(false);
    const [buttonFocused, setButtonFocused] = React.useState(false);

    // Get display value
    const displayValue = React.useMemo(() => {
      if (!value) return "";
      const matchingOption = options.find((opt) => opt.value === value);
      if (matchingOption) return matchingOption.label;
      return value;
    }, [value, options]);

    // Sync input value with display value when not editing (adjust state during render)
    const [prevDisplayValue, setPrevDisplayValue] = React.useState(displayValue);
    const [prevOpen, setPrevOpen] = React.useState(open);
    if (prevDisplayValue !== displayValue || prevOpen !== open) {
      setPrevDisplayValue(displayValue);
      setPrevOpen(open);
      if (!open) setInputValue(displayValue);
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);

      if (allowCustom) {
        // Try to find a matching option
        const matchingOption = options.find(
          (opt) =>
            opt.label.toLowerCase() === newValue.toLowerCase() ||
            opt.value.toLowerCase() === newValue.toLowerCase()
        );

        if (matchingOption) {
          onChange(matchingOption.value);
        } else if (newValue === "") {
          onChange(undefined);
        } else {
          onChange(newValue);
        }
      }
    };

    const handleOptionSelect = (option: ComboInputOption) => {
      onChange(option.value);
      setInputValue(option.label);
      setOpen(false);
      setHighlightedIndex(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (open) {
          // Navigate dropdown when open
          if (e.key === "ArrowDown") {
            setHighlightedIndex((prev) =>
              prev < options.length - 1 ? prev + 1 : prev
            );
          } else {
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          }
        } else if (step !== undefined) {
          // Increment/decrement numeric value when dropdown is closed
          const numeric = parseFloat(inputValue);
          const base = !isNaN(numeric) ? numeric : (resolvedValue ?? 0);
          const delta = e.key === "ArrowUp" ? step : -step;
          let next = base + delta;
          if (min !== undefined) next = Math.max(min, next);
          if (max !== undefined) next = Math.min(max, next);
          const strVal = String(next);
          onChange(strVal);
          setInputValue(strVal);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (open && highlightedIndex >= 0) {
          handleOptionSelect(options[highlightedIndex]);
        } else if (allowCustom && inputValue !== "") {
          onChange(inputValue);
          setOpen(false);
          setHighlightedIndex(-1);
        }
      } else if (e.key === "Escape") {
        setOpen(false);
        setHighlightedIndex(-1);
      }
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div
            className={cn("relative flex items-center w-full gap-px rounded-input", className)}
          >
            {hasLeadElement && scrubEnabled ? (
              <div
                {...scrubProps}
                onPointerDown={(e: React.PointerEvent) => {
                  // Commit any pending custom value before scrub starts
                  if (allowCustom && inputValue !== "" && inputValue !== displayValue) {
                    flushSync(() => onChange(inputValue));
                  }
                  scrubProps.onPointerDown(e);
                }}
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
            ) : (
              <>
                {LeadIcon && (
                  <LeadIcon className="absolute left-0 w-6 h-6 text-stone-900 dark:text-stone-100 pointer-events-none" />
                )}
                {!LeadIcon && property && (
                  <span className="absolute left-0 w-6 h-6 flex items-center justify-center text-[11px] font-[450] tracking-[-0.055px] text-stone-500 dark:text-stone-400 pointer-events-none">
                    {property}
                  </span>
                )}
              </>
            )}
            <input
              ref={ref}
              type="text"
              value={isScrubbing ? displayValue : inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={(e) => {
                setInputFocused(true);
                e.target.select();
              }}
              onBlur={() => {
                setInputFocused(false);
                if (inputValue === "" && resetOnClear !== undefined) {
                  onChange(resetOnClear);
                  onBlur?.(resetOnClear);
                } else if (allowCustom && inputValue !== "" && inputValue !== displayValue) {
                  // Clamp numeric values to min/max on blur (Bug 6 fix)
                  const clamped = clampNumericValue(inputValue, { min, max });
                  if (clamped !== inputValue) {
                    setInputValue(clamped ?? "");
                  }
                  onChange(clamped);
                }
              }}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(
                "flex-1 min-w-0 h-6 pr-1.5 text-[11px] font-[450] tracking-[-0.055px] bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 border-0 rounded-l-input",
                "focus-visible:outline-none",
                "hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors duration-150",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                isScrubbing && "!bg-stone-200 dark:!bg-stone-700 !transition-none",
                (LeadIcon || property) ? "pl-6" : "pl-1.5"
              )}
              style={inputFocused && !isScrubbing ? { outline: "1px solid black", outlineOffset: "-1px" } : undefined}
              aria-expanded={open}
              aria-haspopup="listbox"
            />
            <PopoverTrigger asChild>
            <button
              type="button"
              onFocus={() => setButtonFocused(true)}
              onBlur={() => setButtonFocused(false)}
              disabled={disabled}
              className={cn(
                "w-6 h-6 flex items-center justify-center bg-stone-100 dark:bg-stone-800 rounded-r-input",
                "hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors",
                "focus-visible:outline-none",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                isScrubbing && "!bg-stone-200 dark:!bg-stone-700 !transition-none"
              )}
              style={buttonFocused ? { outline: "1px solid black", outlineOffset: "-1px" } : undefined}
              aria-label="Toggle options"
            >
              <ChevronDown
                className={cn(
                  "w-6 h-6 text-stone-900 dark:text-stone-100 transition-transform",
                  open && "rotate-180"
                )}
              />
            </button>
            </PopoverTrigger>
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="p-0 border-0 bg-transparent shadow-none w-auto"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          style={{
            width: menuWidth === "trigger"
              ? "var(--radix-popover-trigger-width)"
              : menuWidth === "auto"
                ? "auto"
                : `${menuWidth}px`,
            minWidth: menuWidth === "auto" ? 120 : undefined,
          }}
        >
          <DropdownMenu
            options={options}
            value={selectedValue ?? value}
            highlightedIndex={highlightedIndex}
            onSelect={handleOptionSelect}
            onHighlight={setHighlightedIndex}
            showCheckmark
          />
        </PopoverContent>
      </Popover>
    );
  }
);

ComboInput.displayName = "ComboInput";

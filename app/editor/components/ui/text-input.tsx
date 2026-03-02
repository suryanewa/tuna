"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextInputProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  onBlur?: (value: string | undefined) => void;
  placeholder?: string;
  property?: string;
  leadIcon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      value,
      onChange,
      onBlur,
      placeholder,
      property,
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      if (newValue === "") {
        onChange(undefined);
      } else {
        onChange(newValue);
      }
    };

    return (
      <div
        className={cn(
          "group/textinput relative flex items-center w-full rounded-input",
          className
        )}
        style={
          isFocused
            ? { outline: "1px solid black", outlineOffset: "-1px" }
            : undefined
        }
        onFocusCapture={() => setIsFocused(true)}
        onBlurCapture={() => {
          setIsFocused(false);
          onBlur?.(displayValue === "" ? undefined : displayValue);
        }}
      >
        {hasLeadElement && (
          <div className="absolute left-0 w-6 h-6 flex items-center justify-center z-[1]">
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
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full h-6 pr-1.5 text-[11px] font-[450] tracking-[-0.055px] bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 border-0 rounded-input",
            "placeholder:text-stone-400 dark:placeholder:text-stone-500",
            "focus-visible:outline-none",
            "group-hover/textinput:bg-stone-200 dark:group-hover/textinput:bg-stone-700 transition-colors duration-150",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            hasLeadElement ? "pl-6" : "pl-2",
            inputClassName
          )}
        />
      </div>
    );
  }
);

TextInput.displayName = "TextInput";

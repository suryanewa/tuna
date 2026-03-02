"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useScrub, EW_RESIZE_CURSOR } from "@/app/editor/hooks/useScrub";

export interface MultiNumberInputField<K extends string = string> {
  key: K;
  value: string | undefined;
  icon?: React.ComponentType<{ className?: string }>;
  property?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export interface MultiNumberInputProps<K extends string = string> {
  fields: MultiNumberInputField<K>[];
  onChange: (key: K, value: string | undefined) => void;
  disabled?: boolean;
  className?: string;
}

export function MultiNumberInput<K extends string = string>({
  fields,
  onChange,
  disabled = false,
  className,
}: MultiNumberInputProps<K>) {
  const handleChange = (
    key: K,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newValue = e.target.value;
    if (newValue === "") {
      onChange(key, undefined);
    } else {
      onChange(key, newValue);
    }
  };

  const handleKeyDown = (
    field: MultiNumberInputField<K>,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const currentValue = parseFloat(field.value || "0") || 0;
      const step = field.step || 1;
      const delta = e.key === "ArrowUp" ? step : -step;
      let newValue = currentValue + delta;

      if (field.min !== undefined) newValue = Math.max(field.min, newValue);
      if (field.max !== undefined) newValue = Math.min(field.max, newValue);

      onChange(field.key, String(newValue));
    }
  };

  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <div
      className={cn(
        "relative flex items-center h-6 rounded-input",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={() => setIsFocused(false)}
    >
      {/* Focus ring overlay */}
      {isFocused && (
        <div className="absolute inset-0 rounded-input pointer-events-none border border-black z-10" />
      )}
      {fields.map((field, index) => (
        <MultiNumberField
          key={field.key}
          field={field}
          index={index}
          total={fields.length}
          disabled={disabled}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          onInputChange={handleChange}
        />
      ))}
    </div>
  );
}

MultiNumberInput.displayName = "MultiNumberInput";

// Sub-component so useScrub hook can be called per-field
interface MultiNumberFieldProps<K extends string> {
  field: MultiNumberInputField<K>;
  index: number;
  total: number;
  disabled: boolean;
  onChange: (key: K, value: string | undefined) => void;
  onKeyDown: (field: MultiNumberInputField<K>, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onInputChange: (key: K, e: React.ChangeEvent<HTMLInputElement>) => void;
}

function MultiNumberField<K extends string>({
  field,
  index,
  total,
  disabled,
  onChange,
  onKeyDown,
  onInputChange,
}: MultiNumberFieldProps<K>) {
  const Icon = field.icon;
  const hasLeadElement = Icon || field.property;
  const displayValue =
    field.value === undefined || field.value === ""
      ? ""
      : String(field.value);
  const isFirst = index === 0;
  const isLast = index === total - 1;

  const handleScrubChange = React.useCallback(
    (v: string | undefined) => onChange(field.key, v),
    [onChange, field.key]
  );

  const { scrubProps, isScrubbing } = useScrub({
    value: field.value,
    onChange: handleScrubChange,
    step: field.step,
    min: field.min,
    max: field.max,
    disabled: disabled || !hasLeadElement,
  });

  return (
    <div
      className={cn(
        "relative flex items-center flex-1 min-w-0 h-full",
        "bg-stone-100 dark:bg-stone-800",
        "hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors duration-150",
        isScrubbing && "!bg-stone-200 dark:!bg-stone-700 !transition-none",
        isFirst && "rounded-l-input",
        isLast && "rounded-r-input",
        !isLast && "border-r border-stone-200 dark:border-stone-700"
      )}
    >
      {hasLeadElement && (
        <div
          {...scrubProps}
          style={disabled ? undefined : { cursor: EW_RESIZE_CURSOR }}
          className="absolute left-0 w-6 h-6 flex items-center justify-center z-[1]"
        >
          {Icon ? (
            <Icon
              className="w-6 h-6 text-stone-900 dark:text-stone-100 pointer-events-none"
              aria-hidden="true"
            />
          ) : (
            <span className="text-[11px] font-[450] tracking-[-0.055px] text-stone-500 dark:text-stone-400 pointer-events-none">
              {field.property}
            </span>
          )}
        </div>
      )}
      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={(e) => onInputChange(field.key, e)}
        onKeyDown={(e) => onKeyDown(field, e)}
        placeholder={field.placeholder || "0"}
        disabled={disabled}
        className={cn(
          "w-full h-full bg-transparent text-[11px] font-[450] tracking-[-0.055px] text-stone-900 dark:text-stone-100 border-0",
          "focus-visible:outline-none",
          "disabled:cursor-not-allowed",
          "placeholder:text-stone-400 dark:placeholder:text-stone-500",
          hasLeadElement ? "pl-6 pr-1.5" : "px-1.5"
        )}
        aria-label={field.property || field.key}
      />
    </div>
  );
}

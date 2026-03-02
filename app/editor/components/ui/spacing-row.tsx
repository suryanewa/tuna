"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { EditorSelect } from "./editor-select";
import { LinkSmall, LinkBroken } from "@/components/icons/editor";

export type SpacingSide = "all" | "x" | "y" | "top" | "right" | "bottom" | "left";

export interface SpacingRowProps {
  type: "padding" | "margin";
  side: SpacingSide;
  value: string | undefined;
  secondValue?: string | undefined;
  linked: boolean;
  options: string[];
  onChange: (value: string | undefined) => void;
  onSecondValueChange?: (value: string | undefined) => void;
  onSideChange: (side: SpacingSide) => void;
  onLinkToggle: () => void;
  disabled?: boolean;
  className?: string;
}

const SIDE_OPTIONS: { value: SpacingSide; label: string }[] = [
  { value: "all", label: "All" },
  { value: "x", label: "X" },
  { value: "y", label: "Y" },
  { value: "top", label: "T" },
  { value: "right", label: "R" },
  { value: "bottom", label: "B" },
  { value: "left", label: "L" },
];

export function SpacingRow({
  type,
  side,
  value,
  secondValue,
  linked,
  options,
  onChange,
  onSecondValueChange,
  onSideChange,
  onLinkToggle,
  disabled = false,
  className,
}: SpacingRowProps) {
  // Extract numeric value from Tailwind class (e.g., "p-4" -> "4")
  const extractValue = (twClass: string | undefined): string => {
    if (!twClass) return "-";
    const match = twClass.match(/[-]?[\d.]+$/);
    return match ? match[0] : "-";
  };

  // Convert options to display format - ensure unique values
  const extractedValues = options.map(extractValue).filter((v) => v !== "-");
  const uniqueValues = Array.from(new Set(extractedValues));
  const displayOptions = ["-", ...uniqueValues];

  const handleValueChange = (displayValue: string) => {
    if (displayValue === "-") {
      onChange(undefined);
      return;
    }

    // Find matching Tailwind class from options
    const prefix = type === "padding" ? "p" : "m";
    let classPrefix = prefix;

    switch (side) {
      case "x":
        classPrefix = `${prefix}x`;
        break;
      case "y":
        classPrefix = `${prefix}y`;
        break;
      case "top":
        classPrefix = `${prefix}t`;
        break;
      case "right":
        classPrefix = `${prefix}r`;
        break;
      case "bottom":
        classPrefix = `${prefix}b`;
        break;
      case "left":
        classPrefix = `${prefix}l`;
        break;
    }

    const twClass = options.find((opt) => opt === `${classPrefix}-${displayValue}`);
    onChange(twClass);
  };

  return (
    <div className={cn("flex items-center gap-[8px] w-full", className)}>
      {/* Side selector */}
      <select
        value={side}
        onChange={(e) => onSideChange(e.target.value as SpacingSide)}
        disabled={disabled}
        className="w-[48px] shrink-0 h-[24px] px-[4px] text-[11px] bg-[#f3f4f6] rounded-input focus:outline-none focus:ring-1 focus:ring-ring border-0"
      >
        {SIDE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Primary value */}
      <select
        value={extractValue(value)}
        onChange={(e) => handleValueChange(e.target.value)}
        disabled={disabled}
        className="flex-1 min-w-0 h-[24px] px-[4px] text-[11px] bg-[#f3f4f6] rounded-input focus:outline-none focus:ring-1 focus:ring-ring border-0"
      >
        {displayOptions.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>

      {/* Secondary value (for X/Y modes) */}
      {(side === "x" || side === "y") && onSecondValueChange && (
        <select
          value={extractValue(secondValue)}
          onChange={(e) => {
            const displayValue = e.target.value;
            if (displayValue === "-") {
              onSecondValueChange(undefined);
              return;
            }
            const prefix = type === "padding" ? "p" : "m";
            const classPrefix = side === "x" ? `${prefix}y` : `${prefix}x`;
            const twClass = options.find((opt) => opt === `${classPrefix}-${displayValue}`);
            onSecondValueChange(twClass);
          }}
          disabled={disabled}
          className="flex-1 min-w-0 h-[24px] px-[4px] text-[11px] bg-[#f3f4f6] rounded-input focus:outline-none focus:ring-1 focus:ring-ring border-0"
        >
          {displayOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {/* Link toggle */}
      <button
        onClick={onLinkToggle}
        disabled={disabled}
        className={cn(
          "w-[24px] h-[24px] shrink-0 flex items-center justify-center rounded-input",
          "hover:bg-muted/50 transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          linked && "bg-muted"
        )}
        title={linked ? "Unlink sides" : "Link all sides"}
      >
        {linked ? (
          <LinkSmall className="w-6 h-6 text-[#6a7282]" />
        ) : (
          <LinkBroken className="w-6 h-6 text-[#6a7282]" />
        )}
      </button>
    </div>
  );
}

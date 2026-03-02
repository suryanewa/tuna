"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface PositionDiagramProps {
  top: string | undefined;
  right: string | undefined;
  bottom: string | undefined;
  left: string | undefined;
  options: string[];
  onChange: (side: "top" | "right" | "bottom" | "left", value: string | undefined) => void;
  disabled?: boolean;
  className?: string;
}

// Extract numeric value from Tailwind class
const extractValue = (twClass: string | undefined): string => {
  if (!twClass) return "-";
  if (twClass.includes("auto")) return "auto";
  if (twClass.includes("full")) return "full";
  const match = twClass.match(/[-]?[\d./]+$/);
  return match ? match[0] : "-";
};

const POSITION_VALUES = ["-", "0", "0.5", "1", "1.5", "2", "2.5", "3", "4", "5", "6", "8", "10", "12", "16", "20", "24", "auto", "1/2", "full"];

export function PositionDiagram({
  top,
  right,
  bottom,
  left,
  options,
  onChange,
  disabled = false,
  className,
}: PositionDiagramProps) {
  const handleChange = (side: "top" | "right" | "bottom" | "left", displayValue: string) => {
    if (displayValue === "-") {
      onChange(side, undefined);
      return;
    }

    const twClass = options.find((opt) => {
      const val = extractValue(opt);
      return opt.startsWith(`${side}-`) && val === displayValue;
    });

    onChange(side, twClass);
  };

  const PositionInput = ({
    side,
    value,
    label,
  }: {
    side: "top" | "right" | "bottom" | "left";
    value: string | undefined;
    label: string;
  }) => (
    <div className="flex items-center gap-[4px]">
      <span className="text-[10px] font-medium text-[#6a7282]">{label}</span>
      <select
        value={extractValue(value)}
        onChange={(e) => handleChange(side, e.target.value)}
        disabled={disabled}
        className={cn(
          "w-[40px] h-[24px] px-[4px] text-[11px] font-[450] bg-[#f3f4f6] text-stone-900 rounded-input text-center",
          "focus:outline-none focus:ring-1 focus:ring-ring border-0",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "appearance-none cursor-pointer"
        )}
      >
        {POSITION_VALUES.map((val) => (
          <option key={val} value={val}>
            {val}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className={cn("py-[4px]", className)}>
      {/* Top input */}
      <div className="flex justify-center mb-[4px]">
        <PositionInput side="top" value={top} label="T" />
      </div>

      {/* Middle row: Left, Center box, Right */}
      <div className="flex items-center justify-between gap-[8px]">
        <PositionInput side="left" value={left} label="L" />

        {/* Center preview box */}
        <div className="w-[48px] h-[32px] border border-[#d1d5db] bg-[#f9fafb] rounded-input flex-shrink-0" />

        <PositionInput side="right" value={right} label="R" />
      </div>

      {/* Bottom input */}
      <div className="flex justify-center mt-[4px]">
        <PositionInput side="bottom" value={bottom} label="B" />
      </div>
    </div>
  );
}

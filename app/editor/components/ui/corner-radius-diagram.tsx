"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface CornerRadiusDiagramProps {
  topLeft: string | undefined;
  topRight: string | undefined;
  bottomRight: string | undefined;
  bottomLeft: string | undefined;
  linked: boolean;
  options: string[];
  onChange: (corner: "tl" | "tr" | "br" | "bl" | "all", value: string | undefined) => void;
  onLinkToggle: () => void;
  disabled?: boolean;
  className?: string;
}

// Extract numeric value from Tailwind class
const extractValue = (twClass: string | undefined): string => {
  if (!twClass) return "-";
  if (twClass.includes("none")) return "0";
  if (twClass.includes("full")) return "full";
  const match = twClass.match(/(sm|md|lg|xl|2xl|3xl)$/);
  if (match) return match[0];
  if (twClass.endsWith("rounded-tl") || twClass.endsWith("rounded-tr") ||
      twClass.endsWith("rounded-bl") || twClass.endsWith("rounded-br") ||
      twClass === "rounded") return "md";
  return "-";
};

const RADIUS_VALUES = ["-", "0", "sm", "md", "lg", "xl", "2xl", "3xl", "full"];

// Corner icons as Unicode characters
const CORNER_ICONS = {
  tl: "⌝",
  tr: "⌜",
  bl: "⌟",
  br: "⌞",
};

export function CornerRadiusDiagram({
  topLeft,
  topRight,
  bottomRight,
  bottomLeft,
  linked,
  options,
  onChange,
  onLinkToggle,
  disabled = false,
  className,
}: CornerRadiusDiagramProps) {
  const handleChange = (corner: "tl" | "tr" | "br" | "bl", displayValue: string) => {
    if (displayValue === "-") {
      onChange(corner, undefined);
      return;
    }

    const prefixMap = {
      tl: "rounded-tl",
      tr: "rounded-tr",
      br: "rounded-br",
      bl: "rounded-bl",
    };

    const prefix = prefixMap[corner];
    let twClass: string;

    if (displayValue === "0") {
      twClass = `${prefix}-none`;
    } else if (displayValue === "md") {
      twClass = prefix;
    } else {
      twClass = `${prefix}-${displayValue}`;
    }

    if (linked) {
      onChange("all", twClass);
    } else {
      onChange(corner, twClass);
    }
  };

  const CornerInput = ({
    corner,
    value,
  }: {
    corner: "tl" | "tr" | "br" | "bl";
    value: string | undefined;
  }) => (
    <div className="flex items-center gap-[4px] flex-1 min-w-0">
      <span className="text-[11px] text-[#6a7282] shrink-0">{CORNER_ICONS[corner]}</span>
      <select
        value={extractValue(value)}
        onChange={(e) => handleChange(corner, e.target.value)}
        disabled={disabled}
        className={cn(
          "w-full h-[24px] px-[8px] text-[11px] font-[450] bg-[#f3f4f6] text-stone-900 rounded-input",
          "focus:outline-none focus:ring-1 focus:ring-ring border-0",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "cursor-pointer"
        )}
      >
        {RADIUS_VALUES.map((val) => (
          <option key={val} value={val}>
            {val}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className={cn("space-y-[8px]", className)}>
      {/* Top row: TL and TR */}
      <div className="flex items-center gap-[8px]">
        <CornerInput corner="tl" value={topLeft} />
        <CornerInput corner="tr" value={topRight} />
      </div>

      {/* Bottom row: BL and BR */}
      <div className="flex items-center gap-[8px]">
        <CornerInput corner="bl" value={bottomLeft} />
        <CornerInput corner="br" value={bottomRight} />
      </div>
    </div>
  );
}

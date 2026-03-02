"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabOption {
  value: string;
  label: string;
}

export interface SectionTabsProps {
  tabs: TabOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function SectionTabs({
  tabs,
  value,
  onChange,
  disabled = false,
  className,
}: SectionTabsProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-[2px] p-[2px] bg-[#f3f4f6] rounded-input",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          disabled={disabled}
          className={cn(
            "px-[12px] h-[24px] text-[11px] font-medium rounded-input transition-colors",
            "focus:outline-none focus:ring-1 focus:ring-ring",
            value === tab.value
              ? "bg-background text-stone-900 shadow-sm"
              : "text-[#6a7282] hover:text-stone-700 hover:bg-stone-50",
            "disabled:cursor-not-allowed"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

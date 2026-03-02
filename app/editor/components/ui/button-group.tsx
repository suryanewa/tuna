"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonGroupItem {
  icon: React.ComponentType<{ className?: string; size?: number | string }>;
  onClick?: () => void;
  label?: string;
  disabled?: boolean;
}

export interface ButtonGroupProps {
  items: ButtonGroupItem[];
  disabled?: boolean;
  className?: string;
}

export function ButtonGroup({
  items,
  disabled = false,
  className,
}: ButtonGroupProps) {
  return (
    <div
      role="group"
      className={cn(
        "inline-flex items-center h-6 bg-[#f3f4f6] dark:bg-stone-800 rounded-input overflow-hidden",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        const isLast = index === items.length - 1;

        return (
          <button
            key={index}
            type="button"
            aria-label={item.label}
            onClick={item.onClick}
            disabled={disabled || item.disabled}
            className={cn(
              "flex items-center justify-center h-full px-1",
              "text-stone-900 dark:text-stone-100",
              "hover:bg-stone-200 dark:hover:bg-stone-700",
              "transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              !isLast && "border-r border-stone-200 dark:border-stone-700"
            )}
          >
            <Icon className="w-6 h-6" size={24} />
          </button>
        );
      })}
    </div>
  );
}

ButtonGroup.displayName = "ButtonGroup";

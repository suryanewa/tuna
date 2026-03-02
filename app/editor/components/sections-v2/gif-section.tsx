"use client";

import * as React from "react";
import { SectionWrapper, SectionBody, SectionRow } from "./section-wrapper";
import { SectionHeader } from "../ui/section-header";
import { Dropdown, type DropdownOption } from "../ui/dropdown";

// ============================================================================
// Types
// ============================================================================

export interface GifSectionProps {
  fit: string;
  onFitChange: (fit: string) => void;
  alt: string;
  onAltChange: (alt: string) => void;
  onReplace: () => void;
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const fitOptions: DropdownOption[] = [
  { value: "object-cover", label: "Cover" },
  { value: "object-contain", label: "Contain" },
  { value: "object-fill", label: "Fill" },
  { value: "object-none", label: "None" },
  { value: "object-scale-down", label: "Scale Down" },
];

const labelClassName = "text-[9px] font-medium leading-4 tracking-[0.045px] text-stone-500 dark:text-stone-400";

// ============================================================================
// Component
// ============================================================================

export function GifSection({
  fit,
  onFitChange,
  alt,
  onAltChange,
  onReplace,
  disabled = false,
  className,
}: GifSectionProps) {
  return (
    <SectionWrapper className={className}>
      <SectionHeader title="GIF" />
      <SectionBody>
        {/* Row 1: Fit */}
        <SectionRow>
          <div className="flex flex-col">
            <span className={labelClassName}>Fit</span>
            <Dropdown
              value={fit}
              onValueChange={onFitChange}
              options={fitOptions}
              menuWidth={120}
              disabled={disabled}
            />
          </div>
        </SectionRow>

        {/* Row 2: Alt Text */}
        <SectionRow>
          <div className="flex flex-col">
            <span className={labelClassName}>Alt Text</span>
            <textarea
              value={alt ?? ""}
              onChange={(e) => onAltChange(e.target.value || "")}
              placeholder="Describe GIF..."
              disabled={disabled}
              rows={1}
              className="w-full min-h-[24px] px-2 py-1 text-[11px] font-[450] tracking-[-0.055px] bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 border-0 rounded-input placeholder:text-stone-400 dark:placeholder:text-stone-500 focus-visible:outline focus-visible:outline-1 focus-visible:outline-black focus-visible:-outline-offset-1 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed resize-none overflow-hidden field-sizing-content"
            />
          </div>
        </SectionRow>

        {/* Row 3: Replace button */}
        <SectionRow>
          <button
            type="button"
            onClick={onReplace}
            disabled={disabled}
            className="w-full h-7 px-3 text-[11px] font-medium bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-[6px] hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Replace GIF
          </button>
        </SectionRow>
      </SectionBody>
    </SectionWrapper>
  );
}

GifSection.displayName = "GifSection";

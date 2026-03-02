"use client";

import * as React from "react";
import { SectionWrapper, SectionBody, SectionRow } from "./section-wrapper";
import { SectionHeader } from "../ui/section-header";
import { TextInput } from "../ui/text-input";
import { Dropdown, type DropdownOption } from "../ui/dropdown";


// ============================================================================
// Types
// ============================================================================

export interface ImageSectionProps {
  url: string;
  onUrlChange: (url: string) => void;
  onUrlBlur: (url: string) => void;
  fit: string;
  onFitChange: (fit: string) => void;
  position: string;
  onPositionChange: (position: string) => void;
  alt: string;
  onAltChange: (alt: string) => void;
  isVideo?: boolean;
  urlDisabled?: boolean;
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

const positionOptions: DropdownOption[] = [
  { value: "object-center", label: "Center" },
  { value: "object-top", label: "Top" },
  { value: "object-bottom", label: "Bottom" },
  { value: "object-left", label: "Left" },
  { value: "object-right", label: "Right" },
  { value: "object-left-top", label: "Top Left" },
  { value: "object-right-top", label: "Top Right" },
  { value: "object-left-bottom", label: "Bottom Left" },
  { value: "object-right-bottom", label: "Bottom Right" },
];

const labelClassName = "text-[9px] font-medium leading-4 tracking-[0.045px] text-stone-500 dark:text-stone-400";

// ============================================================================
// Component
// ============================================================================

export function ImageSection({
  url,
  onUrlChange,
  onUrlBlur,
  fit,
  onFitChange,
  position,
  onPositionChange,
  alt,
  onAltChange,
  isVideo = false,
  urlDisabled = false,
  disabled = false,
  className,
}: ImageSectionProps) {
  // Local draft state for URL to avoid broken-image flickering during typing
  const [draftUrl, setDraftUrl] = React.useState(url);

  // Sync draft from prop when it changes externally
  React.useEffect(() => {
    setDraftUrl(url);
  }, [url]);

  const handleUrlChange = (value: string | undefined) => {
    const newUrl = value ?? "";
    setDraftUrl(newUrl);
    onUrlChange(newUrl);
  };

  const handleUrlBlur = () => {
    onUrlBlur(draftUrl);
  };

  const handleAltChange = (value: string | undefined) => {
    onAltChange(value ?? "");
  };

  return (
    <SectionWrapper className={className}>
      <SectionHeader title={isVideo ? "Video" : "Image"} />
      <SectionBody>
        {/* Row 1: URL */}
        <SectionRow>
          <TextInput
            value={draftUrl}
            onChange={handleUrlChange}
            onBlur={handleUrlBlur}
            placeholder="https://"
            disabled={disabled || urlDisabled}
          />
        </SectionRow>

        {/* Row 2: Fit + Position */}
        <SectionRow>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0 flex flex-col">
              <span className={labelClassName}>Fit</span>
              <Dropdown
                value={fit}
                onValueChange={onFitChange}
                options={fitOptions}
                menuWidth={120}
                disabled={disabled}
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <span className={labelClassName}>Position</span>
              <Dropdown
                value={position}
                onValueChange={onPositionChange}
                options={positionOptions}
                menuWidth={120}
                disabled={disabled}
              />
            </div>
          </div>
        </SectionRow>

        {/* Row 3: Alt Text (hidden for video) */}
        {!isVideo && (
          <SectionRow>
            <div className="flex flex-col">
              <span className={labelClassName}>Alt Text</span>
              <textarea
                value={alt ?? ""}
                onChange={(e) => handleAltChange(e.target.value || undefined)}
                placeholder="Describe image..."
                disabled={disabled}
                rows={1}
                className="w-full min-h-[24px] px-2 py-1 text-[11px] font-[450] tracking-[-0.055px] bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 border-0 rounded-input placeholder:text-stone-400 dark:placeholder:text-stone-500 focus-visible:outline focus-visible:outline-1 focus-visible:outline-black focus-visible:-outline-offset-1 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed resize-none overflow-hidden field-sizing-content"
              />
            </div>
          </SectionRow>
        )}
      </SectionBody>
    </SectionWrapper>
  );
}

ImageSection.displayName = "ImageSection";

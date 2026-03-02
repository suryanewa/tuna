"use client";

import * as React from "react";
import { SectionWrapper, SectionBody, SectionRow } from "./section-wrapper";
import { SectionHeader } from "../ui/section-header";
import { TextInput } from "../ui/text-input";
import { LabelSegmentedControl } from "../ui/segmented-control";
import { Dropdown, type DropdownOption } from "../ui/dropdown";


// ============================================================================
// Types
// ============================================================================

export interface VideoSectionProps {
  url: string;
  onUrlChange: (url: string) => void;
  onUrlBlur: (url: string) => void;
  autoplay: boolean;
  onAutoplayChange: (value: boolean) => void;
  loop: boolean;
  onLoopChange: (value: boolean) => void;
  controls: boolean;
  onControlsChange: (value: boolean) => void;
  muted: boolean;
  onMutedChange: (value: boolean) => void;
  fit: string;
  onFitChange: (fit: string) => void;
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

const yesNoOptions = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];


const labelClassName = "text-[9px] font-medium leading-4 tracking-[0.045px] text-stone-500 dark:text-stone-400";

// ============================================================================
// Component
// ============================================================================

export function VideoSection({
  url,
  onUrlChange,
  onUrlBlur,
  autoplay,
  onAutoplayChange,
  loop,
  onLoopChange,
  controls,
  onControlsChange,
  muted,
  onMutedChange,
  fit,
  onFitChange,
  urlDisabled = false,
  disabled = false,
  className,
}: VideoSectionProps) {
  // Local draft state for URL to avoid broken-video flickering during typing
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

  return (
    <SectionWrapper className={className}>
      <SectionHeader title="Video" />
      <SectionBody>
        {/* Row 1: URL */}
        <SectionRow>
          <div className="flex flex-col">
            <span className={labelClassName}>URL</span>
            <TextInput
              value={draftUrl}
              onChange={handleUrlChange}
              onBlur={handleUrlBlur}
              placeholder="https://"
              disabled={disabled || urlDisabled}
            />
          </div>
        </SectionRow>

        {/* Row 2: Autoplay + Loop */}
        <SectionRow>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0 flex flex-col">
              <span className={labelClassName}>Autoplay</span>
              <LabelSegmentedControl
                value={autoplay ? "yes" : "no"}
                onValueChange={(v) => onAutoplayChange(v === "yes")}
                options={yesNoOptions}
                fullWidth
                disabled={disabled}
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <span className={labelClassName}>Loop</span>
              <LabelSegmentedControl
                value={loop ? "yes" : "no"}
                onValueChange={(v) => onLoopChange(v === "yes")}
                options={yesNoOptions}
                fullWidth
                disabled={disabled}
              />
            </div>
          </div>
        </SectionRow>

        {/* Row 3: Controls + Muted */}
        <SectionRow>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0 flex flex-col">
              <span className={labelClassName}>Show Controls</span>
              <LabelSegmentedControl
                value={controls ? "yes" : "no"}
                onValueChange={(v) => onControlsChange(v === "yes")}
                options={yesNoOptions}
                fullWidth
                disabled={disabled}
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <span className={labelClassName}>Muted</span>
              <LabelSegmentedControl
                value={muted ? "yes" : "no"}
                onValueChange={(v) => onMutedChange(v === "yes")}
                options={yesNoOptions}
                fullWidth
                disabled={disabled}
              />
            </div>
          </div>
        </SectionRow>

        {/* Row 4: Fit */}
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
      </SectionBody>
    </SectionWrapper>
  );
}

VideoSection.displayName = "VideoSection";

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { FloatingPanel } from "../ui/floating-panel";
import { IconSegmentedControl } from "../ui/segmented-control";
import { Dropdown, type DropdownOption } from "../ui/dropdown";
import { NumberInput } from "../ui/number-input";
import type { TextAlignment } from "./typography-section";
import type {
  TextDecorationValue,
  TextTransformValue,
  TextWrapValue,
  ListStyleValue,
  FontStyleValue,
} from "../adapters/tailwind-adapters";
import {
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  TextAlignJustified,
  MinusSmall,
  Uppercase,
  Lowercase,
  TitleCase,
  Underline,
  StrikeThroughFalse,
  Italic,
  ListView,
  NumberList,
  TruncateText,
} from "@/components/icons/editor";

// ============================================================================
// Types
// ============================================================================

export interface FormattingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactElement;

  textAlign: TextAlignment;
  textDecoration: TextDecorationValue;
  fontStyle?: FontStyleValue;
  textTransform: TextTransformValue;
  textWrap: TextWrapValue;
  listStyle: ListStyleValue;
  truncation: boolean;
  maxLines: number | undefined;

  onTextAlignChange: (v: TextAlignment) => void;
  onTextDecorationChange: (v: TextDecorationValue) => void;
  onFontStyleChange?: (v: FontStyleValue) => void;
  onTextTransformChange: (v: TextTransformValue) => void;
  onTextWrapChange: (v: TextWrapValue) => void;
  onListStyleChange: (v: ListStyleValue) => void;
  onTruncationChange: (v: boolean) => void;
  onMaxLinesChange: (v: number | undefined) => void;

  hasItalic?: boolean;
  disabled?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const rowLabelClassName =
  "text-[11px] font-medium tracking-[0.045px] text-stone-500 dark:text-stone-400";

const alignOptions = [
  { value: "left" as const, icon: TextAlignLeft, label: "Left" },
  { value: "center" as const, icon: TextAlignCenter, label: "Center" },
  { value: "right" as const, icon: TextAlignRight, label: "Right" },
  { value: "justify" as const, icon: TextAlignJustified, label: "Justify" },
];

const caseOptions = [
  { value: "none" as const, icon: MinusSmall, label: "None" },
  { value: "uppercase" as const, icon: Uppercase, label: "Uppercase" },
  { value: "lowercase" as const, icon: Lowercase, label: "Lowercase" },
  { value: "capitalize" as const, icon: TitleCase, label: "Title Case" },
];

const wrapOptions: DropdownOption[] = [
  { value: "wrap", label: "Normal" },
  { value: "nowrap", label: "No Wrap" },
  { value: "balance", label: "Balance" },
  { value: "pretty", label: "Pretty" },
];

const decorationOptions = [
  { value: "none" as const, icon: MinusSmall, label: "None" },
  { value: "underline" as const, icon: Underline, label: "Underline" },
  { value: "line-through" as const, icon: StrikeThroughFalse, label: "Strikethrough" },
];

const fontStyleOptions = [
  { value: "normal" as const, icon: MinusSmall, label: "Normal" },
  { value: "italic" as const, icon: Italic, label: "Italic" },
];

const listStyleOptions = [
  { value: "none" as const, icon: MinusSmall, label: "None" },
  { value: "disc" as const, icon: ListView, label: "Bulleted" },
  { value: "decimal" as const, icon: NumberList, label: "Numbered" },
];

const truncationOptions = [
  { value: "off" as const, icon: MinusSmall, label: "None" },
  { value: "on" as const, icon: TruncateText, label: "Truncate" },
];

// ============================================================================
// Preview Box
// ============================================================================

interface PreviewOverrides {
  textAlign?: TextAlignment;
  textDecoration?: TextDecorationValue;
  fontStyle?: FontStyleValue;
  textTransform?: TextTransformValue;
  textWrap?: TextWrapValue;
  listStyle?: ListStyleValue;
  truncation?: boolean;
}

function PreviewBox({
  textAlign,
  textDecoration,
  fontStyle = "normal",
  textTransform,
  textWrap,
  listStyle,
  truncation,
  maxLines,
  overrides,
}: {
  textAlign: TextAlignment;
  textDecoration: TextDecorationValue;
  fontStyle?: FontStyleValue;
  textTransform: TextTransformValue;
  textWrap: TextWrapValue;
  listStyle: ListStyleValue;
  truncation: boolean;
  maxLines: number | undefined;
  overrides: PreviewOverrides;
}) {
  // Merge actual values with hover overrides
  const align = overrides.textAlign ?? textAlign;
  const decoration = overrides.textDecoration ?? textDecoration;
  const fStyle = overrides.fontStyle ?? fontStyle;
  const transform = overrides.textTransform ?? textTransform;
  const wrap = overrides.textWrap ?? textWrap;
  const list = overrides.listStyle ?? listStyle;
  const trunc = overrides.truncation ?? truncation;

  const textClasses = cn(
    "text-[16px] leading-[22px] text-stone-900 dark:text-stone-300",
    // Alignment
    align === "left" && "text-left",
    align === "center" && "text-center",
    align === "right" && "text-right",
    align === "justify" && "text-justify",
    // Decoration
    decoration === "underline" && "underline",
    decoration === "line-through" && "line-through",
    // Font style
    fStyle === "italic" && "italic",
    // Transform
    transform === "uppercase" && "uppercase",
    transform === "lowercase" && "lowercase",
    transform === "capitalize" && "capitalize",
    // Wrap
    wrap === "nowrap" && "whitespace-nowrap",
    wrap === "balance" && "text-balance",
    wrap === "pretty" && "text-pretty",
  );

  const effectiveMaxLines = trunc ? (maxLines ?? 1) : undefined;
  const truncStyle: React.CSSProperties | undefined =
    effectiveMaxLines !== undefined
      ? {
          overflow: "hidden",
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: Math.min(effectiveMaxLines, 6),
        }
      : undefined;

  return (
    <div className="w-full h-24 bg-stone-100 dark:bg-stone-800 flex items-center px-4 overflow-hidden" style={{ borderRadius: 6 }}>
      {list !== "none" ? (
        <div className={textClasses} style={truncStyle}>
          <span>Animals:</span>
          {list === "disc" ? (
            <ul style={{ listStyleType: "disc", listStylePosition: "inside" }}>
              <li>Brown Fox</li>
              <li>Lazy Dog</li>
            </ul>
          ) : (
            <ol style={{ listStyleType: "decimal", listStylePosition: "inside" }}>
              <li>Brown Fox</li>
              <li>Lazy Dog</li>
            </ol>
          )}
        </div>
      ) : (
        <p className={textClasses} style={truncStyle}>The quick brown fox jumps over the lazy dog.</p>
      )}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function FormattingDialog({
  open,
  onOpenChange,
  trigger,
  textAlign,
  textDecoration,
  fontStyle = "normal",
  textTransform,
  textWrap,
  listStyle,
  truncation,
  maxLines,
  onTextAlignChange,
  onTextDecorationChange,
  onFontStyleChange,
  onTextTransformChange,
  onTextWrapChange,
  onListStyleChange,
  onTruncationChange,
  onMaxLinesChange,
  hasItalic = true,
  disabled = false,
}: FormattingDialogProps) {
  const [hoverOverrides, setHoverOverrides] = React.useState<PreviewOverrides>({});

  // Clear overrides when dialog closes (adjust state during render)
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setHoverOverrides({});
  }

  return (
    <FloatingPanel
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      tabs={[{ value: "formatting", label: "Formatting" }]}
      activeTab="formatting"
      height={384}
      side="left"
      sideOffset={8}
      draggable
    >
      {/* Preview box — non-scrollable */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <PreviewBox
          textAlign={textAlign}
          textDecoration={textDecoration}
          fontStyle={fontStyle}
          textTransform={textTransform}
          textWrap={textWrap}
          listStyle={listStyle}
          truncation={truncation}
          maxLines={maxLines}
          overrides={hoverOverrides}
        />
      </div>

      {/* Scrollable controls */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-2">
        {/* Alignment */}
        <div className="flex items-center justify-between">
          <span className={rowLabelClassName}>Alignment</span>
          <IconSegmentedControl
            options={alignOptions}
            value={textAlign}
            onValueChange={onTextAlignChange}
            onOptionHover={(v) =>
              setHoverOverrides((prev) =>
                v ? { ...prev, textAlign: v as TextAlignment } : { ...prev, textAlign: undefined }
              )
            }
            disabled={disabled}
            compact
          />
        </div>

        {/* Case */}
        <div className="flex items-center justify-between">
          <span className={rowLabelClassName}>Case</span>
          <IconSegmentedControl
            options={caseOptions}
            value={textTransform}
            onValueChange={onTextTransformChange}
            onOptionHover={(v) =>
              setHoverOverrides((prev) =>
                v
                  ? { ...prev, textTransform: v as TextTransformValue }
                  : { ...prev, textTransform: undefined }
              )
            }
            disabled={disabled}
            compact
          />
        </div>

        {/* Wrap */}
        <div className="flex items-center justify-between">
          <span className={rowLabelClassName}>Wrap</span>
          <div className="w-[96px]">
            <Dropdown
              value={textWrap}
              onValueChange={(v) => onTextWrapChange(v as TextWrapValue)}
              options={wrapOptions}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Decoration */}
        <div className="flex items-center justify-between">
          <span className={rowLabelClassName}>Decoration</span>
          <IconSegmentedControl
            options={decorationOptions}
            value={textDecoration}
            onValueChange={onTextDecorationChange}
            onOptionHover={(v) =>
              setHoverOverrides((prev) =>
                v
                  ? { ...prev, textDecoration: v as TextDecorationValue }
                  : { ...prev, textDecoration: undefined }
              )
            }
            disabled={disabled}
            compact
          />
        </div>

        {/* Font Style (italic) */}
        {onFontStyleChange && (
          <div className="flex items-center justify-between">
            <span className={rowLabelClassName}>Style</span>
            <IconSegmentedControl
              options={fontStyleOptions}
              value={fontStyle}
              onValueChange={(v) => onFontStyleChange(v as FontStyleValue)}
              onOptionHover={(v) =>
                setHoverOverrides((prev) =>
                  v
                    ? { ...prev, fontStyle: v as FontStyleValue }
                    : { ...prev, fontStyle: undefined }
                )
              }
              disabled={disabled || !hasItalic}
              compact
            />
          </div>
        )}

        {/* List Style */}
        <div className="flex items-center justify-between">
          <span className={rowLabelClassName}>List Style</span>
          <IconSegmentedControl
            options={listStyleOptions}
            value={listStyle}
            onValueChange={onListStyleChange}
            onOptionHover={(v) =>
              setHoverOverrides((prev) =>
                v
                  ? { ...prev, listStyle: v as ListStyleValue }
                  : { ...prev, listStyle: undefined }
              )
            }
            disabled={disabled}
            compact
          />
        </div>

        {/* Truncation */}
        <div className="flex items-center justify-between">
          <span className={rowLabelClassName}>Truncation</span>
          <IconSegmentedControl
            options={truncationOptions}
            value={truncation ? "on" : "off"}
            onValueChange={(v) => onTruncationChange(v === "on")}
            onOptionHover={(v) =>
              setHoverOverrides((prev) =>
                v
                  ? { ...prev, truncation: v === "on" }
                  : { ...prev, truncation: undefined }
              )
            }
            disabled={disabled}
            compact
          />
        </div>

        {/* Max Lines (conditional) */}
        {truncation && (
          <div className="flex items-center justify-between">
            <span className={rowLabelClassName}>Max Lines</span>
            <div className="w-[48px]">
              <NumberInput
                value={maxLines}
                onChange={(v) => {
                  if (v === undefined || v === "") {
                    onMaxLinesChange(undefined);
                  } else {
                    const n = parseInt(String(v), 10);
                    if (!isNaN(n) && n >= 1) onMaxLinesChange(n);
                  }
                }}
                min={1}
                max={6}
                step={1}
                disabled={disabled}
                className="min-w-0"
              />
            </div>
          </div>
        )}
      </div>
    </FloatingPanel>
  );
}

FormattingDialog.displayName = "FormattingDialog";

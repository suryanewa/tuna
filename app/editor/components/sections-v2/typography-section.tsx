"use client";

import * as React from "react";
import { SectionWrapper, SectionBody, SectionRow } from "./section-wrapper";
import { SectionHeader } from "../ui/section-header";
import { Dropdown } from "../ui/dropdown";
import { ComboInput, type ComboInputOption } from "../ui/combo-input";
import { IconSegmentedControl } from "../ui/segmented-control";
import { IconButton } from "../ui/icon-button";
import { FloatingPanel } from "../ui/floating-panel";
import { FontPicker, FontPickerTrigger } from "../font-picker/FontPicker";
import type { GoogleFontEntry, FontCategory } from "../font-picker/font-data";
import { FormattingDialog } from "./formatting-dialog";
import type {
  TextDecorationValue,
  TextTransformValue,
  TextWrapValue,
  ListStyleValue,
  FontStyleValue,
} from "../adapters/tailwind-adapters";
import { ColorInput, type GradientFill } from "../ui/color-input";
import { ColorPickerDialog } from "../color-picker-dialog";
import {
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  AdjustSmall,
  TextAlignTop,
  TextAlignMiddle,
  TextAlignBottom,
  TextLineHeight,
  TextLetterSpacing,
} from "@/components/icons/editor";

// ============================================================================
// Types
// ============================================================================

export type TextAlignment = "left" | "center" | "right" | "justify";
export type VerticalAlignment = "top" | "middle" | "bottom";

export interface FontWeightOption {
  value: string;
  label: string;
}

export interface TypographySectionProps {
  // Font family
  fontFamily: string;
  onFontFamilyChange: (value: string) => void;

  // Font weight
  fontWeight?: string;
  onFontWeightChange: (value: string) => void;
  fontWeightOptions: FontWeightOption[];

  // Font size
  fontSize: string;
  onFontSizeChange: (value: string) => void;

  // Line height
  lineHeight: string;
  onLineHeightChange: (value: string) => void;

  // Letter spacing (value includes unit: "0%", "-0.5px")
  letterSpacing: string;
  onLetterSpacingChange: (value: string) => void;

  // Text alignment
  textAlign?: TextAlignment;
  onTextAlignChange: (value: TextAlignment) => void;

  // Vertical alignment
  verticalAlign?: VerticalAlignment;
  onVerticalAlignChange: (value: VerticalAlignment) => void;

  // Formatting dialog values
  textDecoration: TextDecorationValue;
  onTextDecorationChange: (value: TextDecorationValue) => void;
  fontStyle?: FontStyleValue;
  onFontStyleChange?: (value: FontStyleValue) => void;
  hasItalic?: boolean;
  textTransform: TextTransformValue;
  onTextTransformChange: (value: TextTransformValue) => void;
  textWrap: TextWrapValue;
  onTextWrapChange: (value: TextWrapValue) => void;
  listStyle: ListStyleValue;
  onListStyleChange: (value: ListStyleValue) => void;
  truncation: boolean;
  onTruncationChange: (value: boolean) => void;
  maxLines: number | undefined;
  onMaxLinesChange: (value: number | undefined) => void;

  // Text color
  textColor?: string;
  onTextColorChange?: (value: string) => void;
  textColorOpacity?: number;
  onTextColorOpacityChange?: (value: number) => void;
  textGradient?: GradientFill;
  onTextGradientChange?: (gradient: GradientFill | undefined) => void;

  // General
  disabled?: boolean;
  className?: string;
  /** When set, undefined values show this as placeholder (e.g. "Mixed" for multi-select) */
  mixedPlaceholder?: string;
}

// ============================================================================
// Constants
// ============================================================================

const fontSizeOptions: ComboInputOption[] = [
  { value: "8", label: "8" },
  { value: "9", label: "9" },
  { value: "10", label: "10" },
  { value: "11", label: "11" },
  { value: "12", label: "12" },
  { value: "14", label: "14" },
  { value: "16", label: "16" },
  { value: "18", label: "18" },
  { value: "20", label: "20" },
  { value: "24", label: "24" },
  { value: "32", label: "32" },
  { value: "40", label: "40" },
  { value: "48", label: "48" },
  { value: "64", label: "64" },
  { value: "72", label: "72" },
  { value: "96", label: "96" },
];

const lineHeightOptions: ComboInputOption[] = [
  { value: "auto", label: "Auto" },
  { value: "12", label: "12" },
  { value: "14", label: "14" },
  { value: "16", label: "16" },
  { value: "18", label: "18" },
  { value: "20", label: "20" },
  { value: "24", label: "24" },
  { value: "28", label: "28" },
  { value: "32", label: "32" },
  { value: "36", label: "36" },
  { value: "40", label: "40" },
  { value: "48", label: "48" },
];

const letterSpacingOptions: ComboInputOption[] = [
  { value: "-2%", label: "-2%" },
  { value: "-1%", label: "-1%" },
  { value: "-0.5%", label: "-0.5%" },
  { value: "0%", label: "0%" },
  { value: "0.5%", label: "0.5%" },
  { value: "1%", label: "1%" },
  { value: "2%", label: "2%" },
  { value: "4%", label: "4%" },
  { value: "8%", label: "8%" },
];

const textAlignOptions = [
  { value: "left" as const, icon: TextAlignLeft, label: "Left" },
  { value: "center" as const, icon: TextAlignCenter, label: "Center" },
  { value: "right" as const, icon: TextAlignRight, label: "Right" },
];

const verticalAlignOptions = [
  { value: "top" as const, icon: TextAlignTop, label: "Top" },
  { value: "middle" as const, icon: TextAlignMiddle, label: "Middle" },
  { value: "bottom" as const, icon: TextAlignBottom, label: "Bottom" },
];

// ============================================================================
// Letter Spacing Helpers
// ============================================================================

type LetterSpacingUnit = "%" | "px";

function parseLetterSpacing(
  raw: string,
  fallbackUnit: LetterSpacingUnit
): { value: number; unit: LetterSpacingUnit } {
  const trimmed = raw.trim();

  if (trimmed.endsWith("px")) {
    const num = Number(trimmed.slice(0, -2).trim());
    return { value: isNaN(num) ? 0 : num, unit: "px" };
  }

  if (trimmed.endsWith("%")) {
    const num = Number(trimmed.slice(0, -1).trim());
    return { value: isNaN(num) ? 0 : num, unit: "%" };
  }

  // No unit suffix — use fallback (current active unit)
  const num = Number(trimmed);
  return { value: isNaN(num) ? 0 : num, unit: fallbackUnit };
}

function formatLetterSpacing(value: number, unit: LetterSpacingUnit): string {
  const str = Number.isInteger(value)
    ? String(value)
    : String(parseFloat(value.toFixed(2)));
  return `${str}${unit}`;
}

// ============================================================================
// Component
// ============================================================================

export function TypographySection({
  fontFamily,
  onFontFamilyChange,
  fontWeight,
  onFontWeightChange,
  fontWeightOptions,
  fontSize,
  onFontSizeChange,
  lineHeight,
  onLineHeightChange,
  letterSpacing,
  onLetterSpacingChange,
  textAlign,
  onTextAlignChange,
  verticalAlign,
  onVerticalAlignChange,
  textDecoration,
  onTextDecorationChange,
  fontStyle,
  onFontStyleChange,
  hasItalic,
  textTransform,
  onTextTransformChange,
  textWrap,
  onTextWrapChange,
  listStyle,
  onListStyleChange,
  truncation,
  onTruncationChange,
  maxLines,
  onMaxLinesChange,
  textColor,
  onTextColorChange,
  textColorOpacity,
  onTextColorOpacityChange,
  textGradient,
  onTextGradientChange,
  disabled = false,
  className,
  mixedPlaceholder,
}: TypographySectionProps) {
  // Color picker state
  const [colorPickerOpen, setColorPickerOpen] = React.useState(false);
  // Font picker state
  const [fontPickerOpen, setFontPickerOpen] = React.useState(false);
  const [hoveredFont, setHoveredFont] = React.useState<string | null>(null);
  const fontBeforeHoverRef = React.useRef<string>(fontFamily);

  // Track the committed font so we can restore on hover-leave
  React.useEffect(() => {
    if (!hoveredFont) {
      fontBeforeHoverRef.current = fontFamily;
    }
  }, [fontFamily, hoveredFont]);

  const handleFontHover = React.useCallback((family: string | null) => {
    setHoveredFont(family);
    if (family) {
      onFontFamilyChange(family);
    } else {
      // Restore original
      onFontFamilyChange(fontBeforeHoverRef.current);
    }
  }, [onFontFamilyChange]);

  // Formatting dialog state
  const [formattingOpen, setFormattingOpen] = React.useState(false);
  const [fontSearch, setFontSearch] = React.useState("");
  const [fontCategory, setFontCategory] = React.useState<FontCategory>("all");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [fontData, setFontData] = React.useState<GoogleFontEntry[]>([]);
  const [fontPreviews, setFontPreviews] = React.useState<
    Record<string, { d: string; vb: string; hr: number }> | undefined
  >();

  // Dynamic import font data + preview data on first open
  React.useEffect(() => {
    if (fontPickerOpen && fontData.length === 0) {
      import("../font-picker/font-data").then((mod) => {
        setFontData(mod.GOOGLE_FONTS_FULL);
      });
      import("../font-picker/font-preview-data").then((mod) => {
        setFontPreviews(mod.FONT_PREVIEWS);
      });
    }
  }, [fontPickerOpen, fontData.length]);

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(fontSearch), 150);
    return () => clearTimeout(t);
  }, [fontSearch]);

  // Reset search/filter on close + restore font if hovering when closed
  const [prevFontPickerOpen, setPrevFontPickerOpen] = React.useState(fontPickerOpen);
  if (fontPickerOpen !== prevFontPickerOpen) {
    setPrevFontPickerOpen(fontPickerOpen);
    if (!fontPickerOpen) {
      setFontSearch("");
      setFontCategory("all");
      // Restore original font if closed while hovering
      if (hoveredFont) {
        setHoveredFont(null);
        onFontFamilyChange(fontBeforeHoverRef.current);
      }
    }
  }

  // Letter spacing local state for unit-switching behavior
  const [letterSpacingInput, setLetterSpacingInput] =
    React.useState(letterSpacing);

  // Derive current unit from the external prop value
  const currentUnit: LetterSpacingUnit = React.useMemo(() => {
    if (letterSpacing.endsWith("px")) return "px";
    return "%";
  }, [letterSpacing]);

  // Sync external prop to local state (adjust state during render)
  const [prevLetterSpacing, setPrevLetterSpacing] = React.useState(letterSpacing);
  if (letterSpacing !== prevLetterSpacing) {
    setPrevLetterSpacing(letterSpacing);
    setLetterSpacingInput(letterSpacing);
  }

  const handleLetterSpacingInputChange = (value: string | undefined) => {
    if (!value || value === "") {
      setLetterSpacingInput("");
      return;
    }

    // Parse and commit to parent
    const parsed = parseLetterSpacing(value, currentUnit);
    if (!isNaN(parsed.value)) {
      const formatted = formatLetterSpacing(parsed.value, parsed.unit);
      setLetterSpacingInput(formatted);
      onLetterSpacingChange(formatted);
    } else {
      setLetterSpacingInput(value);
    }
  };

  // Called by useScrub at scrub end with raw numeric value
  const handleLetterSpacingBlur = (rawValue?: string | undefined) => {
    const input = rawValue ?? letterSpacingInput;
    const parsed = parseLetterSpacing(input, currentUnit);
    const formatted = formatLetterSpacing(
      isNaN(parsed.value) ? 0 : parsed.value,
      parsed.unit
    );
    setLetterSpacingInput(formatted);
    onLetterSpacingChange(formatted);
  };

  return (
    <SectionWrapper className={className}>
      <SectionHeader title="Typography" />
      <SectionBody>
        {/* Row 1: Font Family (full width) */}
        <SectionRow>
          <FloatingPanel
            open={fontPickerOpen}
            onOpenChange={setFontPickerOpen}
            trigger={
              <FontPickerTrigger
                value={fontFamily || "Inter"}
                disabled={disabled}
              />
            }
            tabs={[{ value: "fonts", label: "Fonts" }]}
            activeTab="fonts"
            search={{
              value: fontSearch,
              onChange: setFontSearch,
              placeholder: "Search fonts...",
            }}
            side="left"
            sideOffset={8}
            draggable
          >
            <FontPicker
              fonts={fontData}
              selectedFont={fontFamily}
              onSelect={(font) => {
                setHoveredFont(null);
                fontBeforeHoverRef.current = font;
                onFontFamilyChange(font);
                setFontPickerOpen(false);
              }}
              onHover={handleFontHover}
              searchQuery={debouncedSearch}
              category={fontCategory}
              onCategoryChange={setFontCategory}
              previews={fontPreviews}
            />
          </FloatingPanel>
        </SectionRow>

        {/* Row 2: Weight + Size */}
        <SectionRow>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <Dropdown
                value={fontWeight ?? ""}
                onValueChange={onFontWeightChange}
                options={fontWeightOptions}
                menuWidth={200}
                disabled={disabled}
                placeholder={!fontWeight && mixedPlaceholder ? mixedPlaceholder : undefined}
              />
            </div>
            <div className="flex-1 min-w-0">
              <ComboInput
                value={fontSize}
                onChange={(v) => v !== undefined && onFontSizeChange(v)}
                options={fontSizeOptions}
                disabled={disabled}
                resetOnClear="16"
                step={1}
                min={1}
                placeholder={!fontSize && mixedPlaceholder ? mixedPlaceholder : undefined}
              />
            </div>
          </div>
        </SectionRow>

        {/* Row 3: Line Height + Letter Spacing */}
        <SectionRow>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <ComboInput
                value={lineHeight}
                onChange={(v) => v !== undefined && onLineHeightChange(v)}
                options={lineHeightOptions}
                leadIcon={TextLineHeight}
                disabled={disabled}
                resetOnClear="auto"
                min={0}
                step={1}
                placeholder={!lineHeight && mixedPlaceholder ? mixedPlaceholder : undefined}
              />
            </div>
            <div className="flex-1 min-w-0">
              <ComboInput
                value={letterSpacingInput}
                onChange={handleLetterSpacingInputChange}
                onBlur={handleLetterSpacingBlur}
                options={letterSpacingOptions}
                leadIcon={TextLetterSpacing}
                disabled={disabled}
                resetOnClear="0%"
                step={0.5}
                placeholder={!letterSpacingInput && mixedPlaceholder ? mixedPlaceholder : undefined}
              />
            </div>
          </div>
        </SectionRow>

        {/* Row 4: Text Alignment + Vertical Alignment + Adjust */}
        <SectionRow hasTrailingAction>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <IconSegmentedControl
                options={textAlignOptions}
                value={textAlign}
                onValueChange={onTextAlignChange}
                disabled={disabled}
                fullWidth
              />
            </div>
            <div className="flex-1 min-w-0">
              <IconSegmentedControl
                options={verticalAlignOptions}
                value={verticalAlign}
                onValueChange={onVerticalAlignChange}
                disabled={disabled}
                fullWidth
              />
            </div>
            <FormattingDialog
              open={formattingOpen}
              onOpenChange={setFormattingOpen}
              trigger={
                <IconButton
                  icon={AdjustSmall}
                  disabled={disabled}
                  aria-label="Text formatting"
                  className="flex-shrink-0"
                />
              }
              textAlign={textAlign ?? "left"}
              onTextAlignChange={onTextAlignChange}
              textDecoration={textDecoration}
              onTextDecorationChange={onTextDecorationChange}
              fontStyle={fontStyle}
              onFontStyleChange={onFontStyleChange}
              hasItalic={hasItalic}
              textTransform={textTransform}
              onTextTransformChange={onTextTransformChange}
              textWrap={textWrap}
              onTextWrapChange={onTextWrapChange}
              listStyle={listStyle}
              onListStyleChange={onListStyleChange}
              truncation={truncation}
              onTruncationChange={onTruncationChange}
              maxLines={maxLines}
              onMaxLinesChange={onMaxLinesChange}
              disabled={disabled}
            />
          </div>
        </SectionRow>

        {/* Row 5: Text Color */}
        {onTextColorChange && (
          <SectionRow>
            <ColorPickerDialog
              open={colorPickerOpen}
              onOpenChange={setColorPickerOpen}
              trigger={
                <ColorInput
                  value={textColor}
                  onChange={onTextColorChange}
                  opacity={textColorOpacity}
                  onOpacityChange={onTextColorOpacityChange}
                  gradient={textGradient}
                  disabled={disabled}
                  placeholder={!textColor && mixedPlaceholder ? mixedPlaceholder : undefined}
                />
              }
              value={textColor ?? ""}
              onChange={onTextColorChange}
              opacity={textColorOpacity}
              onOpacityChange={onTextColorOpacityChange}
              gradient={textGradient}
              onGradientChange={onTextGradientChange}
              showOptions={!!onTextGradientChange}
              prefix="text"
            />
          </SectionRow>
        )}
      </SectionBody>
    </SectionWrapper>
  );
}

TypographySection.displayName = "TypographySection";

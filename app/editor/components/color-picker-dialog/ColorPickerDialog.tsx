"use client";

import * as React from "react";
import { FloatingPanel } from "../ui/floating-panel";
import { SaturationValuePicker } from "./SaturationValuePicker";
import ColorSlider from "./ColorSlider";
import ColorModeInputs from "./ColorModeInputs";
import { TailwindPalette } from "./TailwindPalette";
import { OptionsRow, type FillMode, type BlendMode } from "./OptionsRow";
import { GradientEditor } from "./GradientEditor";
import { NestedPickerPortal } from "./NestedPickerPortal";
import {
  type HSVA,
  type ColorMode,
  hexToHsva,
  hsvaToHex,
  hsvToHex,
  parseColorClass,
  getHexForTailwindColor,
} from "./color-utils";
import type { GradientFill } from "../ui/color-input";

// ============================================================================
// Types
// ============================================================================

export interface ColorPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactElement;
  value: string;
  onChange: (value: string) => void;
  opacity?: number;
  onOpacityChange?: (opacity: number) => void;
  gradient?: GradientFill;
  onGradientChange?: (gradient: GradientFill | undefined) => void;
  blendMode?: BlendMode;
  onBlendModeChange?: (mode: BlendMode) => void;
  showOptions?: boolean;
  prefix?: "bg" | "text" | "border" | "shadow";
  /** Position relative to this element instead of the property panel */
  positionRef?: React.RefObject<HTMLElement | null>;
  /** Expose the panel DOM ref so parents can use it for click-outside exclusion */
  panelRef?: React.RefObject<HTMLDivElement | null>;
}

// ============================================================================
// Constants
// ============================================================================

const TABS = [
  { value: "custom", label: "Custom" },
  { value: "tailwind", label: "Tailwind" },
];

const HUE_GRADIENT =
  "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)";

// ============================================================================
// Helpers
// ============================================================================

function resolveHexFromValue(value: string, prefix: string): string {
  if (!value) return "#000000";
  if (value.startsWith("#")) return value;

  const parsed = parseColorClass(value, prefix);
  if (parsed.isCustom && parsed.customHex) return parsed.customHex;
  if (parsed.colorName && parsed.shade) {
    return getHexForTailwindColor(parsed.colorName, parsed.shade);
  }
  return "#000000";
}

// ============================================================================
// Component
// ============================================================================

export function ColorPickerDialog({
  open,
  onOpenChange,
  trigger,
  value,
  onChange,
  opacity = 100,
  onOpacityChange,
  gradient,
  onGradientChange,
  blendMode,
  onBlendModeChange,
  showOptions = true,
  prefix = "bg",
  positionRef,
  panelRef: externalPanelRef,
}: ColorPickerDialogProps) {
  const [activeTab, setActiveTab] = React.useState("custom");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [fillMode, setFillMode] = React.useState<FillMode>(
    gradient ? "gradient" : "solid",
  );
  const [colorMode, setColorMode] = React.useState<ColorMode>("Hex");

  // Gradient stop editing state
  const [selectedStopIndex, setSelectedStopIndex] = React.useState(0);
  const [nestedPickerStopIndex, setNestedPickerStopIndex] = React.useState<number | null>(null);

  // ── Local gradient state (avoids store round-trip resetting positions) ──
  // The store (PageStyles) only supports gradientStart/gradientEnd at fixed
  // positions 0 and 1. Without local state, every drag event round-trips
  // through the store and snaps positions back. This mirrors the HSVA pattern.
  const [localGradient, setLocalGradient] = React.useState<GradientFill | undefined>(gradient);

  // Sync from parent, but not while actively editing gradient (prevents
  // store round-trip from resetting stop positions during drag)
  React.useEffect(() => {
    if (open && fillMode === "gradient") return;
    setLocalGradient(gradient);
  }, [gradient, open, fillMode]);

  // Refs for nested picker positioning and click-outside exclusion
  const internalPanelRef = React.useRef<HTMLDivElement>(null);
  const panelRef = externalPanelRef ?? internalPanelRef;
  const nestedPickerRef = React.useRef<HTMLDivElement>(null);

  // ── Internal HSVA state (avoids hex round-trip quantization) ────────
  const [hsva, setHsva] = React.useState<HSVA>(() => {
    const hex = resolveHexFromValue(value, prefix);
    return hexToHsva(hex, opacity);
  });
  const lastSentHexRef = React.useRef("");

  // Sync from parent only when the value changes externally
  React.useEffect(() => {
    const hex = resolveHexFromValue(value, prefix);
    if (hex !== lastSentHexRef.current) {
      setHsva(hexToHsva(hex, opacity));
    } else if (Math.round(hsva.a) !== opacity) {
      // Opacity changed externally (e.g. from the ColorInput spinner)
      setHsva((prev) => ({ ...prev, a: opacity }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, opacity, prefix]);

  // Close nested picker when main dialog closes
  React.useEffect(() => {
    if (!open) setNestedPickerStopIndex(null);
  }, [open]);

  // ── Handlers ────────────────────────────────────────────────────────

  const handleHsvaChange = React.useCallback(
    (newHsva: HSVA) => {
      setHsva(newHsva);
      const hex = hsvaToHex(newHsva);
      lastSentHexRef.current = hex;
      onChange(hex);
      if (onOpacityChange && Math.round(newHsva.a) !== opacity) {
        onOpacityChange(Math.round(newHsva.a));
      }
    },
    [onChange, onOpacityChange, opacity],
  );

  const handleSVChange = React.useCallback(
    (s: number, v: number) => {
      handleHsvaChange({ ...hsva, s, v });
    },
    [hsva, handleHsvaChange],
  );

  const handleHueChange = React.useCallback(
    (hue: number) => {
      handleHsvaChange({ ...hsva, h: hue });
    },
    [hsva, handleHsvaChange],
  );

  const handleAlphaChange = React.useCallback(
    (alpha: number) => {
      handleHsvaChange({ ...hsva, a: alpha });
    },
    [hsva, handleHsvaChange],
  );

  const handleFillModeChange = React.useCallback(
    (mode: FillMode) => {
      setFillMode(mode);
      setNestedPickerStopIndex(null);
      if (mode === "gradient" && onGradientChange && !localGradient) {
        const currentHex = hsvaToHex(hsva);
        const newGradient: GradientFill = {
          type: "linear",
          angle: 180,
          stops: [
            { color: currentHex, position: 0 },
            { color: "#000000", position: 1 },
          ],
        };
        setLocalGradient(newGradient);
        onGradientChange(newGradient);
      } else if (mode === "solid" && onGradientChange) {
        setLocalGradient(undefined);
        onGradientChange(undefined);
      }
    },
    [onGradientChange, localGradient, hsva],
  );

  const handleTailwindSelect = React.useCallback(
    (_colorClass: string, hex: string) => {
      onChange(hex);
    },
    [onChange],
  );

  // Gradient handlers
  const handleGradientChange = React.useCallback(
    (newGradient: GradientFill) => {
      setLocalGradient(newGradient);
      onGradientChange?.(newGradient);
    },
    [onGradientChange],
  );

  const handleStopSwatchClick = React.useCallback(
    (index: number) => {
      setNestedPickerStopIndex((prev) => (prev === index ? null : index));
    },
    [],
  );

  const handleNestedPickerClose = React.useCallback(() => {
    setNestedPickerStopIndex(null);
  }, []);

  const handleNestedColorChange = React.useCallback(
    (hex: string) => {
      if (nestedPickerStopIndex === null || !localGradient) return;
      const newGradient = {
        ...localGradient,
        stops: localGradient.stops.map((s, i) =>
          i === nestedPickerStopIndex ? { ...s, color: hex } : s,
        ),
      };
      setLocalGradient(newGradient);
      onGradientChange?.(newGradient);
    },
    [localGradient, nestedPickerStopIndex, onGradientChange],
  );

  const handleNestedOpacityChange = React.useCallback(
    (newOpacity: number) => {
      if (nestedPickerStopIndex === null || !localGradient) return;
      const newGradient = {
        ...localGradient,
        stops: localGradient.stops.map((s, i) =>
          i === nestedPickerStopIndex ? { ...s, opacity: newOpacity } : s,
        ),
      };
      setLocalGradient(newGradient);
      onGradientChange?.(newGradient);
    },
    [localGradient, nestedPickerStopIndex, onGradientChange],
  );

  // ── Derived values ─────────────────────────────────────────────────

  const currentHex = hsvToHex(hsva.h, hsva.s, hsva.v);
  const alphaGradient = `linear-gradient(to right, transparent, ${currentHex})`;
  const height: number | "auto" = activeTab === "tailwind" ? 400 : "auto";

  const nestedPickerStop =
    nestedPickerStopIndex !== null && localGradient
      ? localGradient.stops[nestedPickerStopIndex]
      : null;
  const nestedPickerColor = nestedPickerStop?.color ?? "#000000";
  const nestedPickerOpacity = nestedPickerStop?.opacity ?? 100;

  // Ignore nested picker clicks for the main dialog's click-outside
  const ignoreRefs = React.useMemo(
    () => (nestedPickerRef.current ? [nestedPickerRef] : [nestedPickerRef]),
    [],
  );

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <>
      <FloatingPanel
        open={open}
        onOpenChange={onOpenChange}
        trigger={trigger}
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        search={
          activeTab === "tailwind"
            ? {
                value: searchQuery,
                onChange: setSearchQuery,
                placeholder: "Search colors...",
              }
            : undefined
        }
        height={height}
        panelRef={panelRef}
        ignoreRefs={ignoreRefs}
        positionRef={positionRef}
        draggable
      >
        {activeTab === "custom" ? (
          <div className="flex flex-col min-h-0">
            {/* Fill type toggles + blend mode */}
            {showOptions && (
              <OptionsRow
                mode={fillMode}
                onModeChange={handleFillModeChange}
                blendMode={blendMode}
                onBlendModeChange={onBlendModeChange}
              />
            )}

            {fillMode === "solid" ? (
              <div className="flex flex-col gap-2 p-4">
                <SaturationValuePicker
                  hue={hsva.h}
                  saturation={hsva.s}
                  value={hsva.v}
                  onChange={handleSVChange}
                  mode={colorMode}
                />

                <ColorSlider
                  value={hsva.h}
                  max={360}
                  onChange={handleHueChange}
                  gradient={HUE_GRADIENT}
                  ariaLabel="Hue"
                  handleColor={`hsl(${hsva.h}, 100%, 50%)`}
                />

                <ColorSlider
                  value={hsva.a}
                  max={100}
                  onChange={handleAlphaChange}
                  gradient={alphaGradient}
                  checkerboard
                  ariaLabel="Opacity"
                  handleColor={currentHex}
                />

                <ColorModeInputs hsva={hsva} onChange={handleHsvaChange} mode={colorMode} onModeChange={setColorMode} />
              </div>
            ) : localGradient ? (
              <GradientEditor
                gradient={localGradient}
                onGradientChange={handleGradientChange}
                selectedStopIndex={selectedStopIndex}
                onSelectStop={(index: number) => {
                  setSelectedStopIndex(index);
                  setNestedPickerStopIndex(index);
                }}
                onStopSwatchClick={handleStopSwatchClick}
              />
            ) : null}
          </div>
        ) : (
          <TailwindPalette
            searchQuery={searchQuery}
            prefix={prefix}
            onSelect={handleTailwindSelect}
            selectedValue={value}
          />
        )}
      </FloatingPanel>

      {/* Nested picker for gradient stop color editing */}
      <NestedPickerPortal
        open={nestedPickerStopIndex !== null && open}
        onClose={handleNestedPickerClose}
        color={nestedPickerColor}
        opacity={nestedPickerOpacity}
        onChange={handleNestedColorChange}
        onOpacityChange={handleNestedOpacityChange}
        mainDialogRef={panelRef}
        portalRef={nestedPickerRef}
      />
    </>
  );
}

ColorPickerDialog.displayName = "ColorPickerDialog";

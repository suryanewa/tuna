"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { SaturationValuePicker } from "./SaturationValuePicker";
import ColorSlider from "./ColorSlider";
import ColorModeInputs from "./ColorModeInputs";
import { TailwindPalette } from "./TailwindPalette";
import { SectionHeader } from "../ui/section-header";
import { TextInput } from "../ui/text-input";
import { PortalContainerProvider } from "@/lib/portal-container";
import { CloseSmall, SearchSmall } from "@/components/icons/editor";
import {
  type HSVA,
  type ColorMode,
  hexToHsva,
  hsvaToHex,
  hsvToHex,
} from "./color-utils";

// ============================================================================
// Types
// ============================================================================

interface NestedPickerPortalProps {
  open: boolean;
  onClose: () => void;
  color: string; // hex
  opacity?: number; // 0-100
  onChange: (hex: string) => void;
  onOpacityChange?: (opacity: number) => void;
  /** Ref to the main dialog panel for positioning */
  mainDialogRef: React.RefObject<HTMLDivElement | null>;
  /** Exposed ref for click-outside exclusion */
  portalRef?: React.RefObject<HTMLDivElement | null>;
}

// ============================================================================
// Constants
// ============================================================================

const PANEL_SHADOW =
  "0 0 0.5px rgba(0,0,0,0.08), 0 10px 24px rgba(0,0,0,0.18), 0 2px 5px rgba(0,0,0,0.15)";

const HUE_GRADIENT =
  "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)";

const NESTED_GAP = 8;

const TABS = [
  { value: "custom", label: "Custom" },
  { value: "tailwind", label: "Tailwind" },
];

// ============================================================================
// Component
// ============================================================================

export const NestedPickerPortal = React.memo(function NestedPickerPortal({
  open,
  onClose,
  color,
  opacity: opacityProp = 100,
  onChange,
  onOpacityChange,
  mainDialogRef,
  portalRef: externalRef,
}: NestedPickerPortalProps) {
  const internalRef = React.useRef<HTMLDivElement>(null);
  const ref = externalRef ?? internalRef;
  const setRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [ref],
  );
  const [position, setPosition] = React.useState<{ right: number; bottom: number } | null>(null);
  const [colorMode, setColorMode] = React.useState<ColorMode>("Hex");
  const [activeTab, setActiveTab] = React.useState("custom");
  const [searchQuery, setSearchQuery] = React.useState("");

  // ── Internal HSVA state (avoids hex round-trip quantization) ────────
  const [hsva, setHsva] = React.useState<HSVA>(() => hexToHsva(color, opacityProp));
  const lastSentHexRef = React.useRef("");

  // Sync from parent when color/opacity changes externally
  React.useEffect(() => {
    const hex = color.startsWith("#") ? color : `#${color}`;
    if (hex !== lastSentHexRef.current) {
      setHsva(hexToHsva(hex, opacityProp));
    } else if (Math.round(hsva.a) !== opacityProp) {
      setHsva((prev) => ({ ...prev, a: opacityProp }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, opacityProp]);

  // Position relative to main dialog
  React.useEffect(() => {
    if (!open || !mainDialogRef.current) return;

    const updatePosition = () => {
      if (!mainDialogRef.current) return;
      const rect = mainDialogRef.current.getBoundingClientRect();
      setPosition({
        right: window.innerWidth - rect.left + NESTED_GAP,
        bottom: 16,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [open, mainDialogRef]);

  // Escape key closes nested picker
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    // Use capture to intercept before main dialog's escape handler
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [open, onClose]);

  // Click outside closes nested picker
  React.useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target)) {
        // Don't close if clicking inside the main dialog
        if (mainDialogRef.current?.contains(target)) return;
        onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener("pointerdown", handlePointerDown);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open, onClose, ref, mainDialogRef]);

  // ── Handlers ────────────────────────────────────────────────────────

  const handleHsvaChange = React.useCallback(
    (newHsva: HSVA) => {
      setHsva(newHsva);
      const hex = hsvaToHex(newHsva);
      lastSentHexRef.current = hex;
      onChange(hex);
      if (onOpacityChange && Math.round(newHsva.a) !== opacityProp) {
        onOpacityChange(Math.round(newHsva.a));
      }
    },
    [onChange, onOpacityChange, opacityProp],
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

  const handleTailwindSelect = React.useCallback(
    (_colorClass: string, hex: string) => {
      onChange(hex);
    },
    [onChange],
  );

  // ── Render ─────────────────────────────────────────────────────────

  if (!open || !position) return null;

  const currentHex = hsvToHex(hsva.h, hsva.s, hsva.v);
  const alphaGradient = `linear-gradient(to right, transparent, ${currentHex})`;

  const content = (
    <div
      ref={setRef}
      style={{
        position: "fixed",
        right: position.right,
        bottom: position.bottom,
        zIndex: 51,
        width: 240,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <PortalContainerProvider>
        <div
          className="flex flex-col overflow-clip rounded-[13px] bg-white dark:bg-[#2c2c2c] w-[240px]"
          style={{ height: activeTab === "tailwind" ? 400 : "auto", boxShadow: PANEL_SHADOW }}
        >
          {/* Header with tabs */}
          <SectionHeader
            tabs={TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            iconButton={{
              icon: CloseSmall,
              onClick: onClose,
              "aria-label": "Close",
            }}
          />

          {/* Search bar (Tailwind tab only) */}
          {activeTab === "tailwind" && (
            <div className="px-2 pb-2">
              <TextInput
                value={searchQuery}
                onChange={(v) => setSearchQuery(v ?? "")}
                placeholder="Search colors..."
                leadIcon={SearchSmall}
              />
            </div>
          )}

          {/* Divider */}
          <div className="border-b border-stone-200 dark:border-stone-700" />

          {/* Body */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {activeTab === "custom" ? (
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
            ) : (
              <TailwindPalette
                searchQuery={searchQuery}
                prefix="bg"
                onSelect={handleTailwindSelect}
                selectedValue={color}
              />
            )}
          </div>
        </div>
      </PortalContainerProvider>
    </div>
  );

  return createPortal(content, document.body);
});

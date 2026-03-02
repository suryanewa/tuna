"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Mapping of Tailwind color classes to hex values
const COLOR_HEX_MAP: Record<string, string> = {
  // Theme colors
  "bg-background": "var(--background)",
  "bg-foreground": "var(--foreground)",
  "bg-card": "var(--card)",
  "bg-primary": "var(--primary)",
  "bg-secondary": "var(--secondary)",
  "bg-muted": "var(--muted)",
  "bg-accent": "var(--accent)",
  "bg-transparent": "transparent",
  // Basic
  "bg-white": "#FFFFFF",
  "bg-black": "#000000",
  // Common colors
  "border-border": "var(--border)",
  "border-primary": "var(--primary)",
  "border-transparent": "transparent",
  "border-white": "#FFFFFF",
  "border-black": "#000000",
  "text-foreground": "var(--foreground)",
  "text-primary": "var(--primary)",
  "text-muted-foreground": "var(--muted-foreground)",
  "text-white": "#FFFFFF",
  "text-black": "#000000",
};

// Extract hex value for display
function getDisplayHex(value: string | undefined): string {
  if (!value) return "FFFFFF";

  if (value.startsWith("#")) {
    return value.replace("#", "").toUpperCase();
  }

  const hex = COLOR_HEX_MAP[value];
  if (hex) {
    if (hex.startsWith("var(")) return "Theme";
    if (hex === "transparent") return "transparent";
    return hex.replace("#", "").toUpperCase();
  }

  // Try to extract color from Tailwind class name
  const colorMatch = value.match(/-([\w]+)-(\d+)$/);
  if (colorMatch) {
    // Return a simplified representation
    return `${colorMatch[1]}-${colorMatch[2]}`;
  }

  return value.replace(/^(bg-|text-|border-)/, "");
}

// ============================================================================
// Gradient types
// ============================================================================

export interface GradientStop {
  color: string; // hex, e.g. "#ff0000"
  position: number; // 0 to 1
  opacity?: number; // 0-100, defaults to 100
}

export interface GradientFill {
  type: "linear" | "radial" | "conic";
  stops: GradientStop[];
  angle: number; // degrees (used by linear and conic; ignored by radial)
}

// ============================================================================
// Helpers
// ============================================================================

// CSS named colors → hex (basic set matching Figma behavior)
const NAMED_COLORS: Record<string, string> = {
  white: "FFFFFF", black: "000000",
  red: "FF0000", green: "008000", blue: "0000FF",
  yellow: "FFFF00", cyan: "00FFFF", magenta: "FF00FF",
  orange: "FFA500", purple: "800080", pink: "FFC0CB",
  brown: "A52A2A", gray: "808080", grey: "808080",
  navy: "000080", teal: "008080", maroon: "800000",
  olive: "808000", lime: "00FF00", aqua: "00FFFF",
  fuchsia: "FF00FF", silver: "C0C0C0",
  coral: "FF7F50", salmon: "FA8072", tomato: "FF6347",
  gold: "FFD700", khaki: "F0E68C", indigo: "4B0082",
  violet: "EE82EE", plum: "DDA0DD", orchid: "DA70D6",
  tan: "D2B48C", beige: "F5F5DC", ivory: "FFFFF0",
  lavender: "E6E6FA", crimson: "DC143C", turquoise: "40E0D0",
  chocolate: "D2691E", sienna: "A0522D", peru: "CD853F",
  wheat: "F5DEB3", linen: "FAF0E6", snow: "FFFAFA",
  mint: "98FF98", peach: "FFDAB9", charcoal: "36454F",
};

function resolveColorName(input: string): string | null {
  const hex = NAMED_COLORS[input.toLowerCase().trim()];
  return hex ?? null;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function gradientToCss(gradient: GradientFill, opacity: number = 100): string {
  if (gradient.stops.length < 2) return "none";

  const globalAlpha = opacity / 100;
  const stopsCss = [...gradient.stops]
    .sort((a, b) => a.position - b.position)
    .map((s) => {
      const stopAlpha = ((s.opacity ?? 100) / 100) * globalAlpha;
      const color = stopAlpha < 1 ? hexToRgba(s.color, stopAlpha) : s.color;
      return `${color} ${Math.round(s.position * 100)}%`;
    })
    .join(", ");

  switch (gradient.type) {
    case "linear":
      return `linear-gradient(${gradient.angle}deg, ${stopsCss})`;
    case "radial":
      return `radial-gradient(circle, ${stopsCss})`;
    case "conic":
      return `conic-gradient(from ${gradient.angle}deg, ${stopsCss})`;
  }
}

// ============================================================================
// ColorInput
// ============================================================================

export interface ColorInputProps {
  value: string | undefined;
  onChange: (value: string) => void;
  opacity?: number;
  onOpacityChange?: (opacity: number) => void;
  gradient?: GradientFill;
  placeholder?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function ColorInput({
  value,
  onChange,
  opacity = 100,
  onOpacityChange,
  gradient,
  placeholder,
  onClick,
  disabled = false,
  className,
}: ColorInputProps) {
  const [isFocused, setIsFocused] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState("");
  const isMixed = !value && !!placeholder;
  const displayHex = isMixed ? placeholder : getDisplayHex(value);
  const isTheme = displayHex === "Theme";
  const isTransparent = displayHex === "transparent";

  // Get the hex color value
  const getColorHex = (): string => {
    if (!value) return "#FFFFFF";

    if (value.startsWith("#")) {
      return value;
    }

    const hex = COLOR_HEX_MAP[value];
    if (hex && !hex.startsWith("var(") && hex !== "transparent") {
      return hex;
    }

    // For Tailwind colors, try to show a representative color
    if (value.includes("slate")) return "#64748b";
    if (value.includes("gray")) return "#6b7280";
    if (value.includes("zinc")) return "#71717a";
    if (value.includes("red")) return "#ef4444";
    if (value.includes("orange")) return "#f97316";
    if (value.includes("amber")) return "#f59e0b";
    if (value.includes("yellow")) return "#eab308";
    if (value.includes("lime")) return "#84cc16";
    if (value.includes("green")) return "#22c55e";
    if (value.includes("emerald")) return "#10b981";
    if (value.includes("teal")) return "#14b8a6";
    if (value.includes("cyan")) return "#06b6d4";
    if (value.includes("sky")) return "#0ea5e9";
    if (value.includes("blue")) return "#3b82f6";
    if (value.includes("indigo")) return "#6366f1";
    if (value.includes("violet")) return "#8b5cf6";
    if (value.includes("purple")) return "#a855f7";
    if (value.includes("fuchsia")) return "#d946ef";
    if (value.includes("pink")) return "#ec4899";
    if (value.includes("rose")) return "#f43f5e";

    return "#FFFFFF";
  };

  // Get the split swatch style (left half full color, right half with opacity)
  const getSwatchStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      borderRadius: 2,
    };

    // Mixed state: checkerboard swatch
    if (isMixed) {
      const checkerboard = "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)";
      return {
        ...baseStyle,
        backgroundImage: checkerboard,
        backgroundColor: "#fff",
        backgroundSize: "4px 4px, 4px 4px",
        backgroundPosition: "0 0, 2px 2px",
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
      };
    }

    // Gradient swatch
    if (gradient && gradient.stops.length >= 2) {
      return {
        ...baseStyle,
        backgroundImage: gradientToCss(gradient, opacity),
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
      };
    }

    // Solid swatch
    const colorHex = getColorHex();
    const alphaDecimal = opacity / 100;

    if (opacity === 100) {
      return {
        ...baseStyle,
        backgroundColor: colorHex,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
      };
    }

    // Checkerboard pattern for transparency visualization
    const checkerboard = "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)";

    // Split gradient: left half solid, right half with opacity (works from 0-99%)
    const solidColor = colorHex;
    const transparentColor = hexToRgba(colorHex, alphaDecimal);

    return {
      ...baseStyle,
      backgroundImage: `linear-gradient(to right, ${solidColor} 50%, ${transparentColor} 50%), ${checkerboard}`,
      backgroundSize: "100% 100%, 4px 4px, 4px 4px",
      backgroundPosition: "0 0, 0 0, 2px 2px",
    };
  };

  return (
    <div
      className={cn(
        "relative flex items-center w-full gap-px rounded-input",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      style={isFocused ? { outline: "1px solid black", outlineOffset: "-1px" } : undefined}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={() => setIsFocused(false)}
    >
      {/* Color swatch and hex input */}
      <div className="flex flex-1 min-w-0 items-center h-6 bg-stone-100 dark:bg-stone-800 rounded-l-input">
        <div className="w-6 h-6 flex items-center justify-center shrink-0">
          <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
              "w-3.5 h-3.5 cursor-pointer",
              "transition-all focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
            style={getSwatchStyle()}
            aria-label="Select color"
          />
        </div>
        <input
          type="text"
          value={isEditing ? editValue : (gradient ? gradient.type.charAt(0).toUpperCase() + gradient.type.slice(1) : isTheme ? "Theme" : isTransparent ? "None" : displayHex)}
          readOnly={!!gradient || isTheme || isTransparent || isMixed}
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            if (isEditing) {
              setEditValue(e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20));
            }
          }}
          onFocus={(e) => {
            if (!gradient && !isTheme && !isTransparent) {
              setIsEditing(true);
              setEditValue(isMixed ? "" : displayHex);
              // Select all text on focus
              requestAnimationFrame(() => e.target.select());
            }
          }}
          onBlur={() => {
            if (isEditing) {
              setIsEditing(false);
              const raw = editValue.trim();
              // Try resolving as a named color first
              const namedHex = resolveColorName(raw);
              if (namedHex) {
                onChange(`#${namedHex}`);
                return;
              }
              // Otherwise treat as hex
              const hex = raw.replace(/[^a-fA-F0-9]/g, "");
              if (/^[a-fA-F0-9]{3}$/.test(hex) || /^[a-fA-F0-9]{6}$/.test(hex)) {
                const fullHex = hex.length === 3
                  ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
                  : hex;
                onChange(`#${fullHex}`);
              }
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              setIsEditing(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={cn(
            "flex-1 h-6 text-[11px] font-[450] tracking-[-0.055px] bg-transparent truncate min-w-0 focus-visible:outline-none border-0 transition-colors duration-150",
            isMixed ? "text-stone-500 dark:text-stone-400" : "text-stone-900 dark:text-stone-100"
          )}
        />
      </div>

      {/* Opacity input */}
      <div className="flex items-center gap-1 px-1.5 bg-stone-100 rounded-r-input">
        <input
          type="number"
          value={opacity}
          onClick={(e) => e.stopPropagation()}
          onFocus={(e) => requestAnimationFrame(() => e.target.select())}
          onChange={(e) => onOpacityChange?.(parseInt(e.target.value) || 100)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          disabled={disabled}
          min={0}
          max={100}
          className="w-7 h-6 p-0 text-[11px] text-center font-[450] tracking-[-0.055px] bg-transparent text-stone-900 dark:text-stone-100  focus-visible:outline-none border-0 transition-colors duration-150 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          aria-label="Opacity"
        />
        <span className="text-[10px] tracking-[-0.055px] text-stone-500 dark:text-stone-400">%</span>
      </div>
    </div>
  );
}

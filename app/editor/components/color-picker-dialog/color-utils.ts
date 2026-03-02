// ============================================================================
// Color Picker Utilities
// HSV/HSL/RGB/Hex conversions, Tailwind palette data, class builders
// ============================================================================

// ============================================================================
// Types
// ============================================================================

export interface HSVA {
  h: number; // 0-360
  s: number; // 0-100
  v: number; // 0-100
  a: number; // 0-100
}

export interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

export type ColorMode = "Hex" | "RGB" | "HSL" | "HSB";

// ============================================================================
// RGB <-> Hex
// ============================================================================

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const full =
    h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(full);
  if (!result) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ============================================================================
// RGB <-> HSV
// ============================================================================

export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: h * 360,
    s: s * 100,
    v: v * 100,
  };
}

export function hsvToRgb(h: number, s: number, v: number): RGB {
  s /= 100;
  v /= 100;

  if (s === 0) {
    const val = Math.round(v * 255);
    return { r: val, g: val, b: val };
  }

  h = h >= 360 ? 0 : h;
  h /= 60;
  const i = Math.floor(h);
  const f = h - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));

  let r: number, g: number, b: number;
  switch (i) {
    case 0:
      r = v; g = t; b = p;
      break;
    case 1:
      r = q; g = v; b = p;
      break;
    case 2:
      r = p; g = v; b = t;
      break;
    case 3:
      r = p; g = q; b = v;
      break;
    case 4:
      r = t; g = p; b = v;
      break;
    default:
      r = v; g = p; b = q;
      break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

// ============================================================================
// HSV <-> HSL (direct, no RGB roundtrip)
// ============================================================================

export function hsvToHsl(h: number, s: number, v: number): HSL {
  const sF = s / 100;
  const vF = v / 100;

  const l = vF * (1 - sF / 2);
  let sHsl: number;

  if (l === 0 || l === 1) {
    sHsl = 0;
  } else {
    sHsl = (vF - l) / Math.min(l, 1 - l);
  }

  return {
    h,
    s: sHsl * 100,
    l: l * 100,
  };
}

export function hslToHsv(h: number, s: number, l: number): { h: number; s: number; v: number } {
  const sF = s / 100;
  const lF = l / 100;

  const v = lF + sF * Math.min(lF, 1 - lF);
  let sHsv: number;

  if (v === 0) {
    sHsv = 0;
  } else {
    sHsv = 2 * (1 - lF / v);
  }

  return {
    h,
    s: sHsv * 100,
    v: v * 100,
  };
}

// ============================================================================
// Hex <-> HSL
// ============================================================================

export function hexToHsl(hex: string): HSL {
  const { r, g, b } = hexToRgb(hex);
  let rF = r / 255;
  let gF = g / 255;
  let bF = b / 255;

  const max = Math.max(rF, gF, bF);
  const min = Math.min(rF, gF, bF);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rF:
        h = ((gF - bF) / d + (gF < bF ? 6 : 0)) / 6;
        break;
      case gF:
        h = ((bF - rF) / d + 2) / 6;
        break;
      case bF:
        h = ((rF - gF) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

// ============================================================================
// Hex <-> HSV (convenience)
// ============================================================================

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsv(r, g, b);
}

export function hsvToHex(h: number, s: number, v: number): string {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

// ============================================================================
// HSVA helpers
// ============================================================================

export function hexToHsva(hex: string, alpha: number = 100): HSVA {
  const { h, s, v } = hexToHsv(hex);
  return { h, s, v, a: alpha };
}

export function hsvaToHex(hsva: HSVA): string {
  return hsvToHex(hsva.h, hsva.s, hsva.v);
}

export function hsvaToRgb(hsva: HSVA): RGB {
  return hsvToRgb(hsva.h, hsva.s, hsva.v);
}

export function hsvaToHsl(hsva: HSVA): HSL {
  return hsvToHsl(hsva.h, hsva.s, hsva.v);
}

// ============================================================================
// Tailwind Color Palette
// ============================================================================

export const TAILWIND_COLORS: Record<string, Record<string, string>> = {
  slate: {
    "50": "#f8fafc", "100": "#f1f5f9", "200": "#e2e8f0", "300": "#cbd5e1",
    "400": "#94a3b8", "500": "#64748b", "600": "#475569", "700": "#334155",
    "800": "#1e293b", "900": "#0f172a", "950": "#020617",
  },
  gray: {
    "50": "#f9fafb", "100": "#f3f4f6", "200": "#e5e7eb", "300": "#d1d5db",
    "400": "#9ca3af", "500": "#6b7280", "600": "#4b5563", "700": "#374151",
    "800": "#1f2937", "900": "#111827", "950": "#030712",
  },
  zinc: {
    "50": "#fafafa", "100": "#f4f4f5", "200": "#e4e4e7", "300": "#d4d4d8",
    "400": "#a1a1aa", "500": "#71717a", "600": "#52525b", "700": "#3f3f46",
    "800": "#27272a", "900": "#18181b", "950": "#09090b",
  },
  neutral: {
    "50": "#fafafa", "100": "#f5f5f5", "200": "#e5e5e5", "300": "#d4d4d4",
    "400": "#a3a3a3", "500": "#737373", "600": "#525252", "700": "#404040",
    "800": "#262626", "900": "#171717", "950": "#0a0a0a",
  },
  stone: {
    "50": "#fafaf9", "100": "#f5f5f4", "200": "#e7e5e4", "300": "#d6d3d1",
    "400": "#a8a29e", "500": "#78716c", "600": "#57534e", "700": "#44403c",
    "800": "#292524", "900": "#1c1917", "950": "#0c0a09",
  },
  red: {
    "50": "#fef2f2", "100": "#fee2e2", "200": "#fecaca", "300": "#fca5a5",
    "400": "#f87171", "500": "#ef4444", "600": "#dc2626", "700": "#b91c1c",
    "800": "#991b1b", "900": "#7f1d1d", "950": "#450a0a",
  },
  orange: {
    "50": "#fff7ed", "100": "#ffedd5", "200": "#fed7aa", "300": "#fdba74",
    "400": "#fb923c", "500": "#f97316", "600": "#ea580c", "700": "#c2410c",
    "800": "#9a3412", "900": "#7c2d12", "950": "#431407",
  },
  amber: {
    "50": "#fffbeb", "100": "#fef3c7", "200": "#fde68a", "300": "#fcd34d",
    "400": "#fbbf24", "500": "#f59e0b", "600": "#d97706", "700": "#b45309",
    "800": "#92400e", "900": "#78350f", "950": "#451a03",
  },
  yellow: {
    "50": "#fefce8", "100": "#fef9c3", "200": "#fef08a", "300": "#fde047",
    "400": "#facc15", "500": "#eab308", "600": "#ca8a04", "700": "#a16207",
    "800": "#854d0e", "900": "#713f12", "950": "#422006",
  },
  lime: {
    "50": "#f7fee7", "100": "#ecfccb", "200": "#d9f99d", "300": "#bef264",
    "400": "#a3e635", "500": "#84cc16", "600": "#65a30d", "700": "#4d7c0f",
    "800": "#3f6212", "900": "#365314", "950": "#1a2e05",
  },
  green: {
    "50": "#f0fdf4", "100": "#dcfce7", "200": "#bbf7d0", "300": "#86efac",
    "400": "#4ade80", "500": "#22c55e", "600": "#16a34a", "700": "#15803d",
    "800": "#166534", "900": "#14532d", "950": "#052e16",
  },
  emerald: {
    "50": "#ecfdf5", "100": "#d1fae5", "200": "#a7f3d0", "300": "#6ee7b7",
    "400": "#34d399", "500": "#10b981", "600": "#059669", "700": "#047857",
    "800": "#065f46", "900": "#064e3b", "950": "#022c22",
  },
  teal: {
    "50": "#f0fdfa", "100": "#ccfbf1", "200": "#99f6e4", "300": "#5eead4",
    "400": "#2dd4bf", "500": "#14b8a6", "600": "#0d9488", "700": "#0f766e",
    "800": "#115e59", "900": "#134e4a", "950": "#042f2e",
  },
  cyan: {
    "50": "#ecfeff", "100": "#cffafe", "200": "#a5f3fc", "300": "#67e8f9",
    "400": "#22d3ee", "500": "#06b6d4", "600": "#0891b2", "700": "#0e7490",
    "800": "#155e75", "900": "#164e63", "950": "#083344",
  },
  sky: {
    "50": "#f0f9ff", "100": "#e0f2fe", "200": "#bae6fd", "300": "#7dd3fc",
    "400": "#38bdf8", "500": "#0ea5e9", "600": "#0284c7", "700": "#0369a1",
    "800": "#075985", "900": "#0c4a6e", "950": "#082f49",
  },
  blue: {
    "50": "#eff6ff", "100": "#dbeafe", "200": "#bfdbfe", "300": "#93c5fd",
    "400": "#60a5fa", "500": "#3b82f6", "600": "#2563eb", "700": "#1d4ed8",
    "800": "#1e40af", "900": "#1e3a8a", "950": "#172554",
  },
  indigo: {
    "50": "#eef2ff", "100": "#e0e7ff", "200": "#c7d2fe", "300": "#a5b4fc",
    "400": "#818cf8", "500": "#6366f1", "600": "#4f46e5", "700": "#4338ca",
    "800": "#3730a3", "900": "#312e81", "950": "#1e1b4b",
  },
  violet: {
    "50": "#f5f3ff", "100": "#ede9fe", "200": "#ddd6fe", "300": "#c4b5fd",
    "400": "#a78bfa", "500": "#8b5cf6", "600": "#7c3aed", "700": "#6d28d9",
    "800": "#5b21b6", "900": "#4c1d95", "950": "#2e1065",
  },
  purple: {
    "50": "#faf5ff", "100": "#f3e8ff", "200": "#e9d5ff", "300": "#d8b4fe",
    "400": "#c084fc", "500": "#a855f7", "600": "#9333ea", "700": "#7e22ce",
    "800": "#6b21a8", "900": "#581c87", "950": "#3b0764",
  },
  fuchsia: {
    "50": "#fdf4ff", "100": "#fae8ff", "200": "#f5d0fe", "300": "#f0abfc",
    "400": "#e879f9", "500": "#d946ef", "600": "#c026d3", "700": "#a21caf",
    "800": "#86198f", "900": "#701a75", "950": "#4a044e",
  },
  pink: {
    "50": "#fdf2f8", "100": "#fce7f3", "200": "#fbcfe8", "300": "#f9a8d4",
    "400": "#f472b6", "500": "#ec4899", "600": "#db2777", "700": "#be185d",
    "800": "#9d174d", "900": "#831843", "950": "#500724",
  },
  rose: {
    "50": "#fff1f2", "100": "#ffe4e6", "200": "#fecdd3", "300": "#fda4af",
    "400": "#fb7185", "500": "#f43f5e", "600": "#e11d48", "700": "#be123c",
    "800": "#9f1239", "900": "#881337", "950": "#4c0519",
  },
};

export const TAILWIND_COLOR_FAMILIES = Object.keys(TAILWIND_COLORS);
export const TAILWIND_SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

export const SPECIAL_COLORS: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
};

// ============================================================================
// Reverse lookup: hex -> Tailwind color name
// ============================================================================

const HEX_TO_TAILWIND = new Map<string, { name: string; shade: string }>();

for (const [name, shades] of Object.entries(TAILWIND_COLORS)) {
  for (const [shade, hex] of Object.entries(shades)) {
    HEX_TO_TAILWIND.set(hex.toLowerCase(), { name, shade });
  }
}

export function hexToTailwind(hex: string): { name: string; shade: string } | undefined {
  return HEX_TO_TAILWIND.get(hex.toLowerCase());
}

// ============================================================================
// Tailwind class utilities
// ============================================================================

export function getHexForTailwindColor(colorName: string, shade: string): string {
  if (colorName === "white") return "#ffffff";
  if (colorName === "black") return "#000000";
  if (colorName === "transparent") return "transparent";

  const palette = TAILWIND_COLORS[colorName];
  if (palette && shade && palette[shade]) {
    return palette[shade];
  }

  return "#000000";
}

export function parseColorClass(
  value: string,
  prefix: string,
): { colorName: string; shade: string; opacity: number; isCustom: boolean; customHex: string } {
  if (!value) {
    return { colorName: "", shade: "", opacity: 100, isCustom: false, customHex: "" };
  }

  // Check for custom hex: bg-[#ff0000] or bg-[#ff0000]/50
  const customMatch = value.match(new RegExp(`^${prefix}-\\[#([a-fA-F0-9]{3,8})\\](?:\\/(\\d+))?$`));
  if (customMatch) {
    let hex = customMatch[1];
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const opacity = customMatch[2] ? parseInt(customMatch[2]) : 100;
    return { colorName: "", shade: "", opacity, isCustom: true, customHex: `#${hex}` };
  }

  // Check for standard class: bg-red-500/50
  const opacityMatch = value.match(new RegExp(`^${prefix}-([a-z]+)(?:-(\\d+))?(?:\\/(\\d+))?$`));
  if (opacityMatch) {
    const colorName = opacityMatch[1];
    const shade = opacityMatch[2] || "";
    const opacity = opacityMatch[3] ? parseInt(opacityMatch[3]) : 100;
    return { colorName, shade, opacity, isCustom: false, customHex: "" };
  }

  return { colorName: "", shade: "", opacity: 100, isCustom: false, customHex: "" };
}

export function buildColorClass(
  prefix: string,
  colorName: string,
  shade: string,
  opacity: number,
  isCustom: boolean,
  customHex: string,
): string {
  if (isCustom && customHex) {
    const hex = customHex.replace("#", "");
    if (opacity < 100) {
      return `${prefix}-[#${hex}]/${opacity}`;
    }
    return `${prefix}-[#${hex}]`;
  }

  if (!colorName) return "";

  let className = `${prefix}-${colorName}`;
  if (shade) {
    className += `-${shade}`;
  }
  if (opacity < 100) {
    className += `/${opacity}`;
  }
  return className;
}

// ============================================================================
// Flat list for TailwindPalette (virtualized rendering)
// ============================================================================

export type TailwindPaletteItem =
  | { type: "header"; family: string }
  | { type: "color"; family: string; shade: string; hex: string };

let _flatPaletteCache: TailwindPaletteItem[] | null = null;

export function getFlatTailwindPalette(): TailwindPaletteItem[] {
  if (_flatPaletteCache) return _flatPaletteCache;

  const items: TailwindPaletteItem[] = [];
  for (const family of TAILWIND_COLOR_FAMILIES) {
    items.push({ type: "header", family });
    for (const shade of TAILWIND_SHADES) {
      items.push({ type: "color", family, shade, hex: TAILWIND_COLORS[family][shade] });
    }
  }
  _flatPaletteCache = items;
  return items;
}

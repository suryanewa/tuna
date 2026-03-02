import { getWeightsForFont, hasItalicForFont } from "./font-weights";

const loadedFonts = new Map<string, "preview" | "full">();

/**
 * Build the Google Fonts CSS2 axis string for a font.
 * If the font supports italic, uses `ital,wght@0,W;1,W` format.
 * Otherwise, uses `wght@W` format.
 */
function buildAxisString(fontName: string, mode: "preview" | "full"): string {
  if (mode === "preview") return "wght@400";

  const weights = getWeightsForFont(fontName);
  if (hasItalicForFont(fontName)) {
    const entries = [
      ...weights.map((w) => `0,${w}`),
      ...weights.map((w) => `1,${w}`),
    ];
    return `ital,wght@${entries.join(";")}`;
  }
  return `wght@${weights.join(";")}`;
}

/**
 * Load a Google Font. Supports two modes:
 * - "preview": loads wght@400 only — for font picker list
 * - "full" (default): loads all available weights + italic (if supported)
 */
export function loadGoogleFont(
  fontName: string,
  mode: "preview" | "full" = "full"
): void {
  if (!fontName || typeof document === "undefined") return;

  const existing = loadedFonts.get(fontName);
  if (existing === "full" || (existing === "preview" && mode === "preview"))
    return;

  loadedFonts.set(fontName, mode);
  const axis = buildAxisString(fontName, mode);
  const link = document.createElement("link");
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:${axis}&display=swap`;
  link.rel = "stylesheet";
  document.head.appendChild(link);
}

/**
 * Batch-load multiple fonts in one request using Google Fonts multi-family syntax.
 * Used by the virtualizer to load visible fonts efficiently.
 */
export function loadGoogleFontsBatch(fontNames: string[]): void {
  if (typeof document === "undefined") return;
  const toLoad = fontNames.filter((f) => !loadedFonts.has(f));
  if (toLoad.length === 0) return;

  const BATCH_SIZE = 50;
  for (let i = 0; i < toLoad.length; i += BATCH_SIZE) {
    const batch = toLoad.slice(i, i + BATCH_SIZE);
    batch.forEach((f) => loadedFonts.set(f, "preview"));
    const families = batch
      .map((f) => `family=${encodeURIComponent(f)}:wght@400`)
      .join("&");
    const link = document.createElement("link");
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
}

export function isFontLoaded(fontName: string): boolean {
  return loadedFonts.has(fontName);
}

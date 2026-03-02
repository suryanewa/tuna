import type { ShadowValue } from "./shadow-section";

// ============================================================================
// Types
// ============================================================================

export interface ShadowLayer {
  x: number;
  y: number;
  blur: number;
  spread: number;
  alpha: number;
  inset: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const SHADOW_BASE_BLUR = 50;

// ============================================================================
// Easing functions (from d3-ease)
// ============================================================================

const easeQuadIn = (t: number) => t * t;
const easeQuadOut = (t: number) => t * (2 - t);
const easeCubicInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function normalize(value: number, min: number, max: number) {
  return (value - min) / (max - min);
}

// ============================================================================
// Shadow generation (ported from alexwidua/figma-beautiful-shadows)
// ============================================================================

export function generateShadowLayers(
  shadow: ShadowValue,
  numLayers = 6
): ShadowLayer[] {
  const brightnessNorm = shadow.brightness / 100;
  const elevationNorm = shadow.elevation / 100;
  const opacityNorm = shadow.opacity / 100;

  if (elevationNorm === 0 || (brightnessNorm === 0 && opacityNorm === 0)) {
    return [];
  }

  const angleRad = shadow.angle * (Math.PI / 180);
  const scale = shadow.distance;
  const blurDistanceFactor = Math.max(scale / 100, 0.1);
  const isInset = shadow.type === "inside";

  const layers: ShadowLayer[] = [];

  for (let i = 0; i < numLayers; i++) {
    const t = normalize(i, 0, numLayers);

    const baseAlpha = brightnessNorm - brightnessNorm * easeCubicInOut(t);
    const alpha = Math.round(baseAlpha * opacityNorm * 100) / 100;

    const offsetFactor = easeQuadIn(t) * 5;
    const x = Math.round(
      Math.cos(angleRad) * scale * elevationNorm * offsetFactor
    );
    const y = Math.round(
      Math.sin(angleRad) * scale * elevationNorm * offsetFactor
    );

    const blurFactor = easeQuadOut(t);
    const blur = Math.round(
      SHADOW_BASE_BLUR * blurDistanceFactor * blurFactor * (elevationNorm * 2)
    );

    if (x === 0 && y === 0 && blur === 0) continue;
    if (alpha <= 0) continue;

    layers.push({ x, y, blur, spread: 0, alpha, inset: isInset });
  }

  return layers;
}

export function generateBeautifulShadow(shadow: ShadowValue): string {
  const layers = generateShadowLayers(shadow);
  if (layers.length === 0) return "none";

  const hex = shadow.color.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16) || 0;
  const g = parseInt(hex.slice(2, 4), 16) || 0;
  const b = parseInt(hex.slice(4, 6), 16) || 0;

  return layers
    .map((l) => {
      const inset = l.inset ? "inset " : "";
      return `${inset}${l.x}px ${l.y}px ${l.blur}px ${l.spread}px rgba(${r}, ${g}, ${b}, ${l.alpha})`;
    })
    .join(", ");
}

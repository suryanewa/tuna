export type Camera = { x: number; y: number; zoom: number };

/** Zoom bounds: 5% to 1600% */
export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 16.0;

/**
 * Convert viewport-relative screen coordinates to world coordinates.
 * sx, sy are relative to the canvas element's top-left corner.
 */
export function screenToWorld(
  sx: number,
  sy: number,
  cam: Camera
): { x: number; y: number } {
  return {
    x: (sx - cam.x) / cam.zoom,
    y: (sy - cam.y) / cam.zoom,
  };
}

/**
 * Convert world coordinates to viewport-relative screen coordinates.
 */
export function worldToScreen(
  wx: number,
  wy: number,
  cam: Camera
): { x: number; y: number } {
  return {
    x: wx * cam.zoom + cam.x,
    y: wy * cam.zoom + cam.y,
  };
}

/**
 * Compute a new camera that zooms to newZoom while keeping the
 * viewport-relative point (vpX, vpY) fixed on the same world point.
 * vpX, vpY are VIEWPORT-RELATIVE (not raw clientX/clientY).
 */
export function zoomAtPoint(
  cam: Camera,
  newZoom: number,
  vpX: number,
  vpY: number
): Camera {
  // Clamp zoom to valid range
  const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
  // The world point under the cursor
  const wx = (vpX - cam.x) / cam.zoom;
  const wy = (vpY - cam.y) / cam.zoom;
  // New camera position so that (wx, wy) stays at (vpX, vpY)
  return {
    x: vpX - wx * clampedZoom,
    y: vpY - wy * clampedZoom,
    zoom: clampedZoom,
  };
}

/**
 * Compute a camera that centers the given world-space rectangle
 * in the viewport with optional padding.
 */
export function cameraToFitRect(
  rect: { x: number; y: number; width: number; height: number },
  vpWidth: number,
  vpHeight: number,
  padding: number = 40
): Camera {
  const availW = vpWidth - padding * 2;
  const availH = vpHeight - padding * 2;
  // Scale to fit
  const zoom = Math.max(
    MIN_ZOOM,
    Math.min(MAX_ZOOM, Math.min(availW / rect.width, availH / rect.height))
  );
  // Center the rect
  const x = (vpWidth - rect.width * zoom) / 2 - rect.x * zoom;
  const y = (vpHeight - rect.height * zoom) / 2 - rect.y * zoom;
  return { x, y, zoom };
}

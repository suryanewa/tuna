export type Rect = { x: number; y: number; width: number; height: number; rotation?: number };

type HandlePosition = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const HANDLE_AXES: Record<HandlePosition, { dx: -1 | 0 | 1; dy: -1 | 0 | 1 }> = {
  nw: { dx: -1, dy: -1 },
  n:  { dx: 0,  dy: -1 },
  ne: { dx: 1,  dy: -1 },
  e:  { dx: 1,  dy: 0 },
  se: { dx: 1,  dy: 1 },
  s:  { dx: 0,  dy: 1 },
  sw: { dx: -1, dy: 1 },
  w:  { dx: -1, dy: 0 },
};

const MIN_SIZE = 20;

/**
 * Computes the overlay-space rect during an active drag (resize or move).
 *
 * @param startRect   - The overlay-space rect at drag start
 * @param handle      - Which resize handle is being dragged, or "move" for move drag
 * @param screenDx    - Mouse delta in screen-space X (e.clientX - startMouseX)
 * @param screenDy    - Mouse delta in screen-space Y (e.clientY - startMouseY)
 * @param zoomScale   - Current zoom scale (zoom / 100)
 * @param shiftKey    - Whether shift is held (aspect ratio lock)
 * @returns The new overlay-space rect
 */
export function computeDragRect(
  startRect: Rect,
  handle: HandlePosition | "move",
  screenDx: number,
  screenDy: number,
  zoomScale: number,
  shiftKey: boolean
): Rect {
  if (handle === "move") {
    return {
      x: startRect.x + screenDx,
      y: startRect.y + screenDy,
      width: startRect.width,
      height: startRect.height,
    };
  }

  const axes = HANDLE_AXES[handle];
  const minOverlay = MIN_SIZE * zoomScale;

  let { x, y, width, height } = startRect;

  // Horizontal resize
  if (axes.dx === 1) {
    width = Math.max(minOverlay, startRect.width + screenDx);
  } else if (axes.dx === -1) {
    const delta = Math.min(screenDx, startRect.width - minOverlay);
    width = startRect.width - delta;
    x = startRect.x + delta;
  }

  // Vertical resize
  if (axes.dy === 1) {
    height = Math.max(minOverlay, startRect.height + screenDy);
  } else if (axes.dy === -1) {
    const delta = Math.min(screenDy, startRect.height - minOverlay);
    height = startRect.height - delta;
    y = startRect.y + delta;
  }

  // Aspect ratio lock (shift key)
  if (shiftKey && startRect.width > 0 && startRect.height > 0) {
    const ratio = startRect.width / startRect.height;
    if (axes.dx !== 0 && axes.dy !== 0) {
      // Corner handle: constrain to original ratio
      const wFromH = height * ratio;
      const hFromW = width / ratio;
      if (width / ratio < height) {
        height = hFromW;
      } else {
        width = wFromH;
      }
    } else if (axes.dx !== 0) {
      height = width / ratio;
    } else {
      width = height * ratio;
    }
  }

  return { x, y, width, height };
}

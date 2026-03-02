import { useLayoutEffect, useRef, useState, useCallback, useMemo, type RefObject, type MutableRefObject } from "react";

export type Rect = { x: number; y: number; width: number; height: number; rotation?: number };

/**
 * Measures element positions in un-zoomed world space.
 *
 * The overlay container applies CSS zoom via CameraContext.applyCamera,
 * so world-space positions are converted to screen positions by the
 * browser's layout engine — no React re-render needed for pan or zoom.
 *
 * Re-measures on: selection change, element/container resize,
 * and style attribute mutations (position-only changes like left/top
 * that ResizeObserver doesn't detect).
 *
 * Set `suppressRef.current = true` to skip observer re-measurements
 * during active drag (the overlay uses dragRect instead of measured bounds).
 *
 * @param cameraRef - Ref to the camera state. Used for zoom in the measure
 *   function so that observer-triggered measurements (ResizeObserver,
 *   MutationObserver) always use the zoom value that matches the current
 *   DOM state, not the rAF-debounced React state which can be 1+ frames behind.
 */
export function useElementBounds(
  canvasRef: RefObject<HTMLDivElement | null>,
  elementIds: string[],
  camera: { x: number; y: number; zoom: number },
  worldRef?: RefObject<HTMLDivElement | null>,
  cameraRef?: MutableRefObject<{ zoom: number }>,
): { bounds: Map<string, Rect>; measure: () => void; suppressRef: MutableRefObject<boolean> } {
  const [bounds, setBounds] = useState<Map<string, Rect>>(() => new Map());

  // Stabilize elementIds to prevent infinite re-render loops
  const idsKey = elementIds.join(",");
  const stableIds = useMemo(() => elementIds, [idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const measureRef = useRef<() => void>();
  const suppressRef = useRef(false);

  measureRef.current = () => {
    // Measure relative to worldRef (camera-translated container) when available.
    const measureContainer = worldRef?.current ?? canvasRef.current;
    const queryRoot = canvasRef.current;
    if (!measureContainer || !queryRoot) return;
    const containerRect = measureContainer.getBoundingClientRect();
    // Use cameraRef (updated synchronously in applyCamera) rather than
    // camera (React state, rAF-debounced). This prevents a 1-frame glitch
    // where ResizeObserver fires after CSS zoom changes but before React
    // re-renders, causing getBoundingClientRect values to be divided by
    // the old zoom instead of the new one.
    const zoom = (cameraRef?.current?.zoom ?? camera.zoom) || 1;
    const next = new Map<string, Rect>();

    for (const id of stableIds) {
      const el = queryRoot.querySelector(`[data-element-id="${id}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const htmlEl = el as HTMLElement;

      // Detect rotation via computed style. For rotated elements,
      // getBoundingClientRect returns the axis-aligned bounding box which
      // is inflated. We compute the un-rotated rect instead and store
      // the rotation angle so the overlay can apply it visually.
      const transform = getComputedStyle(htmlEl).rotate;
      let rotation: number | undefined;
      if (transform && transform !== "none") {
        const deg = parseFloat(transform);
        if (!isNaN(deg) && deg !== 0) {
          rotation = deg;
          // offsetWidth/Height are un-rotated layout dimensions (not affected by CSS zoom)
          const w = htmlEl.offsetWidth;
          const h = htmlEl.offsetHeight;
          // Center of the AABB → divide by zoom to get world space
          const cx = (r.left + r.width / 2 - containerRect.left) / zoom;
          const cy = (r.top + r.height / 2 - containerRect.top) / zoom;
          next.set(id, {
            x: cx - w / 2,
            y: cy - h / 2,
            width: w,
            height: h,
            rotation,
          });
          continue;
        }
      }

      // Divide by zoom to convert screen pixels → un-zoomed world space
      next.set(id, {
        x: (r.left - containerRect.left) / zoom,
        y: (r.top - containerRect.top) / zoom,
        width: r.width / zoom,
        height: r.height / zoom,
      });
    }

    // Only update state if bounds actually changed
    setBounds((prev) => {
      if (prev.size !== next.size) return next;
      let changed = false;
      next.forEach((rect, id) => {
        if (changed) return;
        const old = prev.get(id);
        if (!old || old.x !== rect.x || old.y !== rect.y ||
            old.width !== rect.width || old.height !== rect.height ||
            old.rotation !== rect.rotation) {
          changed = true;
        }
      });
      return changed ? next : prev; // No change, keep same reference
    });
  };

  const measure = useCallback(() => {
    measureRef.current?.();
  }, []);

  // Re-measure when selection changes.
  // Pan is handled by the overlay's CSS translate matching the world div.
  // Zoom is handled by the overlay's CSS scale — no remeasurement needed.
  useLayoutEffect(() => {
    measure();
  }, [stableIds, measure]);

  // Re-measure on resize (container + individual elements)
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resizeObserver = new ResizeObserver(() => {
      if (!suppressRef.current) measure();
    });
    resizeObserver.observe(canvas);
    // Also observe each measured element so bounds update when
    // element sizes change (e.g. after a resize drag updates Tailwind classes)
    for (const id of stableIds) {
      const el = canvas.querySelector(`[data-element-id="${id}"]`);
      if (el) resizeObserver.observe(el);
    }
    return () => resizeObserver.disconnect();
  }, [canvasRef, stableIds, measure]);

  // Re-measure when a 'bounds-stale' event is dispatched on the canvas
  // (e.g. after a direct canvas drag completes — the wrapper's left/top changed
  // but the inner element's style/class didn't, so MutationObserver misses it)
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleStale = () => measure();
    canvas.addEventListener('bounds-stale', handleStale);
    return () => canvas.removeEventListener('bounds-stale', handleStale);
  }, [canvasRef, measure]);

  // Re-measure on style attribute mutations (catches position-only changes
  // like left/top from the property panel that ResizeObserver misses)
  // and on childList mutations (catches DOM reordering from move up/down)
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || stableIds.length === 0) return;

    const attrObserver = new MutationObserver(() => {
      if (!suppressRef.current) measure();
    });

    for (const id of stableIds) {
      const el = canvas.querySelector(`[data-element-id="${id}"]`);
      if (el) {
        attrObserver.observe(el, {
          attributes: true,
          attributeFilter: ["style", "class"],
        });
      }
      // Also observe canvas wrapper elements — their style.left/top
      // change when updateElement sets el.x/el.y, but the inner
      // data-element-id element's style/class doesn't change.
      const wrapper = canvas.querySelector(`[data-canvas-wrapper="${id}"]`);
      if (wrapper) {
        attrObserver.observe(wrapper, {
          attributes: true,
          attributeFilter: ["style"],
        });
      }
    }

    // Watch for DOM reordering (e.g. move element up/down in sibling list)
    // Skip mutations on worldRef itself (transform changes during pan/zoom)
    const worldEl = worldRef?.current;
    const childListObserver = new MutationObserver((mutations) => {
      if (suppressRef.current) return;
      const isWorldOnly = worldEl && mutations.every(m => m.target === worldEl);
      if (!isWorldOnly) measure();
    });
    childListObserver.observe(canvas, { childList: true, subtree: true });

    return () => {
      attrObserver.disconnect();
      childListObserver.disconnect();
    };
  }, [canvasRef, stableIds, measure]);

  return { bounds, measure, suppressRef };
}

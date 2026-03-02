"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  type ReactNode,
  type MutableRefObject,
  type RefObject,
} from "react";
import type { Camera } from "./camera-utils";

interface CameraContextValue {
  /** React state — re-renders subscribers once per rAF frame */
  camera: Camera;
  /** Ref for hot-path reads (mousemove, gesture handlers) — always initialized, never null */
  cameraRef: MutableRefObject<Camera>;
  /** Ref to the world-transform div — handles translate (panning) */
  worldRef: RefObject<HTMLDivElement>;
  /** Ref to the page div — handles CSS zoom (crisp text/vector rendering) */
  pageRef: RefObject<HTMLDivElement>;
  /** Ref to the canvas layer div — gets same CSS zoom as pageRef for infinite canvas elements */
  canvasLayerRef: RefObject<HTMLDivElement>;
  /** Ref to the overlay world div — gets same translate as worldRef so overlays track content via GPU compositing */
  overlayWorldRef: RefObject<HTMLDivElement>;
  /** Ref to the overlay zoom div — child of overlayWorldRef, gets same CSS zoom as pageRef */
  overlayZoomRef: RefObject<HTMLDivElement>;
  /** Ref to the base zoom level. Set to 0 to force CSS zoom on next applyCamera. */
  baseZoomRef: MutableRefObject<number>;
  /**
   * Update the camera. Writes translate to worldRef and zoom to pageRef
   * for zero-latency visual updates, then commits to React state.
   * @param cam - The new camera state
   * @param immediate - If true, commit to React state synchronously (for discrete actions like keyboard zoom, menu clicks). If false (default), debounce via requestAnimationFrame (for continuous gestures like pan/zoom drag).
   */
  applyCamera: (cam: Camera, immediate?: boolean) => void;
}

const CameraContext = createContext<CameraContextValue | null>(null);

const DEFAULT_CAMERA: Camera = { x: 0, y: 0, zoom: 1 };

export function CameraProvider({ children }: { children: ReactNode }) {
  const [camera, setCameraState] = useState<Camera>(DEFAULT_CAMERA);
  const cameraRef = useRef<Camera>(DEFAULT_CAMERA);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const canvasLayerRef = useRef<HTMLDivElement | null>(null);
  const overlayWorldRef = useRef<HTMLDivElement | null>(null);
  const overlayZoomRef = useRef<HTMLDivElement | null>(null);
  const commitRafRef = useRef(0);

  // Always use CSS zoom for crisp text rendering at every zoom level.
  // baseZoomRef is kept for compatibility with callers that reset it to 0
  // to signal that DOM zoom state was cleared (page switch, preview exit).
  const baseZoomRef = useRef(0); // 0 = not yet initialized

  const applyCamera = useCallback(
    (cam: Camera, immediate = false) => {
      const prevZoom = cameraRef.current.zoom;
      cameraRef.current = cam;

      // Pan: translate on worldRef + overlayWorldRef (GPU-composited, fast)
      // Both use CSS transform so they update in the same compositor frame.
      const translateCSS = `translate(${cam.x}px, ${cam.y}px)`;
      if (worldRef.current) {
        worldRef.current.style.transform = translateCSS;
      }
      if (overlayWorldRef.current) {
        overlayWorldRef.current.style.transform = translateCSS;
      }

      // Zoom: CSS zoom on content, canvas layer, AND overlay.
      // All three use the same layout-triggering property so they always
      // paint in the same frame — no pipeline desync between content and overlay.
      // (CSS transform:scale is compositor-only and would update ahead of
      // CSS zoom, causing the overlay to lead the content by 1+ frames.)
      if (cam.zoom !== prevZoom || baseZoomRef.current === 0) {
        if (pageRef.current) {
          (pageRef.current.style as any).zoom = String(cam.zoom);
          pageRef.current.style.transform = '';
        }
        if (canvasLayerRef.current) {
          (canvasLayerRef.current.style as any).zoom = String(cam.zoom);
          canvasLayerRef.current.style.transform = '';
        }
        if (overlayZoomRef.current) {
          (overlayZoomRef.current.style as any).zoom = String(cam.zoom);
          // Expose inverse zoom as CSS custom property for label counter-scaling
          overlayZoomRef.current.style.setProperty('--inv-zoom', String(1 / cam.zoom));
        }
        baseZoomRef.current = cam.zoom;
      }

      if (immediate) {
        // Cancel any pending debounced commit
        cancelAnimationFrame(commitRafRef.current);
        setCameraState(cam);
      } else {
        // rAF-debounced commit: cancel previous, schedule new
        cancelAnimationFrame(commitRafRef.current);
        commitRafRef.current = requestAnimationFrame(() => {
          setCameraState(cam);
        });
      }
    },
    [] // stable — no deps since it only uses refs and setState
  );

  const value: CameraContextValue = {
    camera,
    cameraRef,
    worldRef,
    pageRef,
    canvasLayerRef,
    overlayWorldRef,
    overlayZoomRef,
    baseZoomRef,
    applyCamera,
  };

  return (
    <CameraContext.Provider value={value}>{children}</CameraContext.Provider>
  );
}

export function useCamera(): CameraContextValue {
  const ctx = useContext(CameraContext);
  if (!ctx) {
    throw new Error("useCamera must be used within a CameraProvider");
  }
  return ctx;
}

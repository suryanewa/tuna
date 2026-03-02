"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { CanvasElement } from "@/lib/playground/store";
import { useYjsEditor } from "../YjsEditorContext";
import { useEditorMutations, editorStateStore } from "../context";
import { useCamera } from "../CameraContext";

const DRAG_THRESHOLD = 5;
const SELECTION_COLOR = "#3b82f6";

/** Shared flag so EditorCanvas can skip its onClick when a marquee drag occurred */
export const marqueeFlag = { didMarquee: false };

interface MarqueeOverlayProps {
  canvasRef: RefObject<HTMLDivElement | null>;
  isPanningRef: RefObject<boolean>;
}

type Rect = { x: number; y: number; width: number; height: number };

/** Check if two rects intersect */
function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Get the bounding rect of an element relative to a container, in screen coords.
 */
function getElementRect(
  container: HTMLElement,
  containerRect: DOMRect,
  id: string
): Rect | null {
  const el = container.querySelector(`[data-element-id="${id}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: r.left - containerRect.left,
    y: r.top - containerRect.top,
    width: r.width,
    height: r.height,
  };
}

/**
 * Promotion algorithm for Cmd+drag:
 * 1. Start with all leaf elements intersecting the marquee
 * 2. If ALL children of a container are selected, promote to the container
 * 3. Repeat upward until no more promotions
 */
export function computePromotedSelection(
  leafIds: string[],
  elements: Record<string, CanvasElement>
): string[] {
  const selected: Record<string, boolean> = {};
  for (let i = 0; i < leafIds.length; i++) {
    selected[leafIds[i]] = true;
  }

  let changed = true;
  while (changed) {
    changed = false;
    // Collect parent → count of selected children
    const parentCounts: Record<string, number> = {};
    const selectedKeys = Object.keys(selected);

    for (let i = 0; i < selectedKeys.length; i++) {
      const id = selectedKeys[i];
      const el = elements[id];
      if (!el || !el.parentId) continue;
      const parent = elements[el.parentId];
      if (!parent || parent.type !== "container") continue;
      parentCounts[el.parentId] = (parentCounts[el.parentId] || 0) + 1;
    }

    // Promote parents where all children are selected
    const parentIds = Object.keys(parentCounts);
    for (let i = 0; i < parentIds.length; i++) {
      const parentId = parentIds[i];
      const parent = elements[parentId];
      const childCount = parent?.children?.length || 0;
      if (childCount > 0 && parentCounts[parentId] === childCount) {
        // Remove all children, add parent
        const children = parent.children || [];
        for (let j = 0; j < children.length; j++) {
          delete selected[children[j]];
        }
        selected[parentId] = true;
        changed = true;
      }
    }
  }

  return Object.keys(selected);
}

/**
 * Marquee selection: click+drag on empty canvas draws a selection rectangle.
 * Hooks into mousedown on the canvas container element directly so it doesn't
 * block pointer events on elements (which handle their own clicks).
 *
 * Cmd+drag: deep selection — selects leaf elements and promotes to parent
 * containers as the marquee grows to encompass all children. Selection updates
 * live during drag.
 */
export function MarqueeOverlay({ canvasRef, isPanningRef }: MarqueeOverlayProps) {
  const { elements } = useYjsEditor();
  const mutations = useEditorMutations();
  const { cameraRef } = useCamera();

  const [marqueeRect, setMarqueeRect] = useState<Rect | null>(null);

  const startRef = useRef<{ x: number; y: number } | null>(null);
  const activeRef = useRef(false);
  const shiftRef = useRef(false);
  const cmdRef = useRef(false);
  // Snapshot marquee for pointerUp (state may lag behind)
  const marqueeSnapRef = useRef<Rect | null>(null);
  // For Cmd+drag: track selection before marquee started (for shift+cmd+drag)
  const preMarqueeSelectionRef = useRef<string[]>([]);

  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;

    /**
     * For Cmd+drag, compute intersecting leaf elements, then promote.
     * Called on every mousemove for live preview.
     */
    const computeDeepSelection = (mRect: Rect): string[] => {
      const els = elementsRef.current;
      const containerRect = container.getBoundingClientRect();

      // Collect all leaf elements
      const leaves: string[] = [];
      const collectLeaves = (ids: string[]) => {
        for (let i = 0; i < ids.length; i++) {
          const el = els[ids[i]];
          if (!el) continue;
          if (el.type === "container" && el.children && el.children.length > 0) {
            collectLeaves(el.children);
          } else {
            leaves.push(ids[i]);
          }
        }
      };
      const rootIds = Object.values(els)
        .filter(el => el && !el.parentId)
        .map(el => el.id);
      collectLeaves(rootIds);

      // Find leaves intersecting the marquee
      const intersecting: string[] = [];
      for (let i = 0; i < leaves.length; i++) {
        const elRect = getElementRect(container, containerRect, leaves[i]);
        if (elRect && rectsIntersect(mRect, elRect)) {
          intersecting.push(leaves[i]);
        }
      }

      // Promote: if all children of a container are selected, select the container instead
      return computePromotedSelection(intersecting, els);
    };

    /**
     * For normal drag, compute elements at focus level intersecting marquee.
     */
    const computeFocusLevelSelection = (mRect: Rect): string[] => {
      const els = elementsRef.current;
      const containerRect = container.getBoundingClientRect();
      const focusedId = editorStateStore.getSnapshot().focusedContainerId;

      const candidates = focusedId
        ? (els[focusedId]?.children || [])
        : Object.values(els)
            .filter(el => el && !el.parentId)
            .map(el => el.id);

      const intersecting: string[] = [];
      for (let i = 0; i < candidates.length; i++) {
        const elRect = getElementRect(container, containerRect, candidates[i]);
        if (elRect && rectsIntersect(mRect, elRect)) {
          intersecting.push(candidates[i]);
        }
      }
      return intersecting;
    };

    const handleMouseDown = (e: MouseEvent) => {
      const s = editorStateStore.getSnapshot();
      // Only left button, select tool, edit mode, not panning
      if (e.button !== 0) return;
      if (s.creationTool !== "select") return;
      if (s.viewMode !== "edit") return;
      if (isPanningRef.current) return;

      const isCmd = e.metaKey || e.ctrlKey;

      // Without Cmd: only start on empty canvas (not on an element).
      // With Cmd: allow starting anywhere for deep marquee selection.
      if (!isCmd) {
        const target = e.target as HTMLElement;
        if (target.closest("[data-element-id]")) return;
      }

      const rect = container.getBoundingClientRect();
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      startRef.current = pos;
      activeRef.current = false;
      shiftRef.current = e.shiftKey;
      cmdRef.current = isCmd;
      preMarqueeSelectionRef.current = s.selectedIds.slice();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!startRef.current) return;

      const rect = container.getBoundingClientRect();
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const dx = pos.x - startRef.current.x;
      const dy = pos.y - startRef.current.y;

      if (!activeRef.current) {
        if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
        activeRef.current = true;
      }

      const mRect: Rect = {
        x: Math.min(startRef.current.x, pos.x),
        y: Math.min(startRef.current.y, pos.y),
        width: Math.abs(dx),
        height: Math.abs(dy),
      };
      marqueeSnapRef.current = mRect;
      setMarqueeRect(mRect);

      // Live selection update for Cmd+drag
      if (cmdRef.current) {
        const ids = computeDeepSelection(mRect);
        mutations.setSelection(ids);
      }
    };

    const handleMouseUp = () => {
      const wasActive = activeRef.current;
      const mRect = marqueeSnapRef.current;
      const isDeep = cmdRef.current;
      startRef.current = null;
      activeRef.current = false;
      marqueeSnapRef.current = null;
      setMarqueeRect(null);

      if (!wasActive || !mRect) return;
      // Tell EditorCanvas to skip its onClick handler
      marqueeFlag.didMarquee = true;

      // For Cmd+drag, selection was already applied live — nothing to do
      if (isDeep) return;

      // Normal drag: apply selection on mouseup
      const intersecting = computeFocusLevelSelection(mRect);

      if (intersecting.length > 0) {
        if (shiftRef.current) {
          for (let i = 0; i < intersecting.length; i++) {
            mutations.toggleElementSelection(intersecting[i]);
          }
        } else {
          mutations.selectElement(intersecting[0]);
          for (let i = 1; i < intersecting.length; i++) {
            mutations.toggleElementSelection(intersecting[i]);
          }
        }
      } else if (!shiftRef.current) {
        mutations.clearSelection();
      }
    };

    container.addEventListener("mousedown", handleMouseDown);
    // Use capture phase so the marquee receives events even when elements
    // call stopPropagation() during Cmd+hover (deep preview). Without this,
    // the marquee freezes at element boundaries during Cmd+drag.
    window.addEventListener("mousemove", handleMouseMove, true);
    window.addEventListener("mouseup", handleMouseUp, true);
    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove, true);
      window.removeEventListener("mouseup", handleMouseUp, true);
    };
  }, [canvasRef, isPanningRef, mutations]);

  if (!marqueeRect) return null;

  // The marquee state is in screen space (relative to the canvas container)
  // but it renders inside the overlay zoom pipeline (overlayWorldRef + overlayZoomRef)
  // which applies translate(cam.x, cam.y) and CSS zoom. Convert to world space.
  const cam = cameraRef.current;
  const zoom = cam.zoom || 1;
  const worldLeft = (marqueeRect.x - cam.x) / zoom;
  const worldTop = (marqueeRect.y - cam.y) / zoom;
  const worldWidth = marqueeRect.width / zoom;
  const worldHeight = marqueeRect.height / zoom;

  return (
    <div
      style={{
        position: "absolute",
        left: worldLeft,
        top: worldTop,
        width: worldWidth,
        height: worldHeight,
        border: `1px solid ${SELECTION_COLOR}`,
        backgroundColor: `${SELECTION_COLOR}10`,
        pointerEvents: "none",
        zIndex: 39,
      }}
    />
  );
}

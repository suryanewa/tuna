/**
 * Drag-to-reorder integration: detects reorderable containers
 * and enables drag-to-reorder on the selected element.
 *
 * Instead of grip handles, the entire selected element is draggable
 * when it's inside a flex/grid container with 2+ siblings.
 * A long-press (150ms) or immediate drag initiates reorder.
 */

import { useEffect, useRef, useState } from "react";
import type { ReorderableContainer, StructuralChange } from "../types";
import { detectReorderableContainer } from "./detect";
import { createReorderController } from "./reorder";

interface DragHandlesProps {
  /** Currently selected element */
  selectedElement: Element | null;
  /** Shadow root for creating overlay elements */
  shadowRoot: ShadowRoot | null;
  /** Called when a reorder is completed */
  onReorder: (change: StructuralChange) => void;
  /** Called when drag starts (to suppress picker) */
  onDragStart: () => void;
  /** Called when drag ends */
  onDragEnd: () => void;
}

export function DragHandles({
  selectedElement,
  shadowRoot,
  onReorder,
  onDragStart,
  onDragEnd,
}: DragHandlesProps) {
  const [container, setContainer] = useState<ReorderableContainer | null>(null);
  const controllerRef = useRef<ReturnType<typeof createReorderController> | null>(null);
  const dragZoneRef = useRef<HTMLElement | null>(null);

  // Detect reorderable container when selection changes
  useEffect(() => {
    if (!selectedElement) {
      setContainer(null);
      return;
    }
    const detected = detectReorderableContainer(selectedElement);
    setContainer(detected);
  }, [selectedElement]);

  // Set up drag zone over the selected element
  useEffect(() => {
    if (!shadowRoot || !container || !selectedElement) {
      // Clean up
      if (dragZoneRef.current) {
        dragZoneRef.current.remove();
        dragZoneRef.current = null;
      }
      controllerRef.current?.destroy();
      controllerRef.current = null;
      return;
    }

    // Find which child matches the selected element
    const childIndex = container.children.findIndex(
      (c) => c.element === selectedElement
    );
    if (childIndex === -1) {
      // Selected element is not a direct child — could be nested inside one
      // Find the child that contains the selected element
      const parentChild = container.children.find(
        (c) => c.element.contains(selectedElement)
      );
      if (!parentChild) return;
      // Use the containing child as the drag target
    }

    const dragChild = childIndex !== -1
      ? container.children[childIndex]
      : container.children.find((c) => c.element.contains(selectedElement));
    if (!dragChild) return;

    // Create reorder controller
    const controller = createReorderController(shadowRoot, {
      onDragStart,
      onDragCancel: () => {
        if (dragZoneRef.current) dragZoneRef.current.style.pointerEvents = "auto";
        onDragEnd();
      },
      onReorder: (change) => {
        if (dragZoneRef.current) dragZoneRef.current.style.pointerEvents = "auto";
        onDragEnd();
        onReorder(change);
        // Re-detect after DOM reorder
        if (selectedElement) {
          const detected = detectReorderableContainer(selectedElement);
          setContainer(detected);
        }
      },
    });
    controllerRef.current = controller;

    // Create an invisible drag zone over the selected element
    const zone = document.createElement("div");
    zone.setAttribute("data-tuna-drag-zone", "");
    zone.style.cssText = `
      position: fixed;
      z-index: 2147483646;
      cursor: grab;
      pointer-events: auto;
      user-select: none;
      touch-action: none;
      background: transparent;
    `;
    shadowRoot.appendChild(zone);
    dragZoneRef.current = zone;

    // Position over the selected element
    function updatePosition() {
      const rect = dragChild!.element.getBoundingClientRect();
      zone.style.left = `${rect.left}px`;
      zone.style.top = `${rect.top}px`;
      zone.style.width = `${rect.width}px`;
      zone.style.height = `${rect.height}px`;
    }
    updatePosition();

    // Start drag on pointerdown
    zone.addEventListener("pointerdown", (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      zone.style.cursor = "grabbing";
      // Hide drag zone during drag so it doesn't intercept pointer events
      zone.style.pointerEvents = "none";
      controller.startDrag(dragChild!, container, e.clientX, e.clientY);
    });

    // Track position on scroll/resize
    let raf: number | null = null;
    function scheduleUpdate() {
      if (raf !== null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        updatePosition();
      });
    }

    window.addEventListener("scroll", scheduleUpdate, { capture: true, passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });

    return () => {
      zone.remove();
      dragZoneRef.current = null;
      controller.destroy();
      controllerRef.current = null;
      window.removeEventListener("scroll", scheduleUpdate, true);
      window.removeEventListener("resize", scheduleUpdate);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [container, shadowRoot, selectedElement, onReorder, onDragStart, onDragEnd]);

  return null;
}

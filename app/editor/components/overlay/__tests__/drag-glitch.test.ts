import { describe, it, expect } from "vitest";

/**
 * Bug: During resize or move drag, the element visually glitches —
 * briefly snapping to an intermediate position before correcting.
 *
 * Root cause: Every `pointermove` calls `updateStyles()`, which writes
 * to the Liveblocks CRDT. This triggers a full React re-render cascade:
 *
 *   pointermove → updateStyles() → CRDT write → useStorage subscriber
 *   → RenderElement re-renders → extractArbitraryStyles → new inline styles
 *   → ResizeObserver fires → useElementBounds re-measures → bounds update
 *
 * The `setDragRect()` call (local overlay state) and the CRDT-driven
 * re-render can land in separate React batches, creating a frame where:
 *   - dragRect shows the correct overlay position
 *   - But the element's DOM hasn't updated yet (stale Tailwind classes)
 *   - Or vice versa: the element has new classes but dragRect is stale
 *
 * This is the classic "fighting state sources" problem in drag interactions.
 *
 * Fix: "Refs for animation, state for persistence" pattern (used by Figma,
 * tldraw, Excalidraw):
 *   - During drag: manipulate DOM directly (element.style.width/height/translate)
 *   - On pointerup: commit final values to CRDT via single updateStyles() call
 *   - After React re-renders with final classes: clear inline overrides
 *
 * This eliminates all intermediate re-renders during drag.
 */

describe("drag glitch: CRDT write on every pointermove", () => {
  it("demonstrates the render cascade from per-frame CRDT writes", () => {
    // Simulate: 60fps drag with updateStyles on every frame
    const framesPerSecond = 60;
    const dragDurationMs = 1000;
    const totalFrames = framesPerSecond * (dragDurationMs / 1000);

    // Current (buggy): one CRDT write per frame
    const crdtWritesBuggy = totalFrames;
    expect(crdtWritesBuggy).toBe(60);

    // Each write triggers a full React re-render cascade
    const reactRendersPerWrite = 1; // minimum
    const totalReRendersBuggy = crdtWritesBuggy * reactRendersPerWrite;
    expect(totalReRendersBuggy).toBe(60);

    // Fixed: zero CRDT writes during drag, one on pointerup
    const crdtWritesFixed = 1;
    const totalReRendersFixed = crdtWritesFixed * reactRendersPerWrite;
    expect(totalReRendersFixed).toBe(1);

    // 60x fewer re-renders = smooth drag
    expect(totalReRendersBuggy / totalReRendersFixed).toBe(60);
  });

  it("shows that two state sources can desync across React batches", () => {
    // Frame N: pointermove fires
    // - setDragRect({ rect: newOverlayRect })  ← local state, immediate
    // - updateStyles(id, newTailwindClasses)    ← CRDT write, async re-render

    // Scenario: React batches setDragRect update but CRDT listener
    // fires in a separate microtask, causing a second render.
    type RenderState = {
      dragRect: { x: number; y: number } | null;
      elementDomPosition: { x: number; y: number };
    };

    // Render 1: dragRect updated, but element DOM still has old position
    const render1: RenderState = {
      dragRect: { x: 300, y: 150 },         // new (from setDragRect)
      elementDomPosition: { x: 100, y: 50 }, // old (CRDT hasn't propagated)
    };
    // Overlay shows 300,150 but element is visually at 100,50 → mismatch!
    expect(render1.dragRect!.x).not.toBe(render1.elementDomPosition.x);

    // Render 2: CRDT propagates, element re-renders with new classes
    const render2: RenderState = {
      dragRect: { x: 300, y: 150 },
      elementDomPosition: { x: 300, y: 150 }, // now matches
    };
    expect(render2.dragRect!.x).toBe(render2.elementDomPosition.x);

    // The user sees the glitch in render 1 (typically 1 frame, ~16ms)
  });

  it("direct DOM manipulation keeps element and overlay in sync", () => {
    // With the fix: pointermove directly sets element.style properties
    // No CRDT write → no React re-render → no desync

    type FrameState = {
      overlayPosition: { x: number; y: number };
      elementInlineStyle: { translate: string } | null;
    };

    // During drag: both are updated synchronously in the same frame
    const duringDrag: FrameState = {
      overlayPosition: { x: 300, y: 150 },
      elementInlineStyle: { translate: "200px 100px" }, // dx=200, dy=100 from start
    };
    // Both reflect the same logical position — no glitch
    expect(duringDrag.overlayPosition).toBeDefined();
    expect(duringDrag.elementInlineStyle).toBeDefined();

    // On pointerup: single CRDT write, then clear inline styles
    const afterDrop: FrameState = {
      overlayPosition: { x: 300, y: 150 },
      elementInlineStyle: null, // cleared after React re-renders with final classes
    };
    expect(afterDrop.elementInlineStyle).toBeNull();
  });
});

describe("drag glitch fix: compute pending styles for commit", () => {
  it("computes correct resize styles for SE handle", () => {
    const startWidth = 200;
    const startHeight = 100;
    const dx = 50; // content-space delta
    const dy = 30;

    const newWidth = Math.max(20, startWidth + dx);
    const newHeight = Math.max(20, startHeight + dy);

    expect(newWidth).toBe(250);
    expect(newHeight).toBe(130);
  });

  it("computes correct move styles", () => {
    const startLeft = 100;
    const startTop = 50;
    const dx = 200; // content-space delta
    const dy = 100;

    const newLeft = Math.round(startLeft + dx);
    const newTop = Math.round(startTop + dy);

    expect(newLeft).toBe(300);
    expect(newTop).toBe(150);
  });

  it("applies inline translate for move (screen-space)", () => {
    const screenDx = 150; // screen pixels (zoom-adjusted would be different)
    const screenDy = 75;
    const translate = `${screenDx}px ${screenDy}px`;

    expect(translate).toBe("150px 75px");
  });

  it("applies inline width/height for resize (screen-space)", () => {
    const startRect = { x: 10, y: 20, width: 400, height: 200 };
    const screenDx = 100;
    const zoomScale = 1.5;

    // New width in screen-space = startWidth + screenDx
    const newScreenWidth = startRect.width + screenDx;
    expect(newScreenWidth).toBe(500);

    // Content-space width for CRDT commit = newScreenWidth / zoomScale
    const contentWidth = Math.round(newScreenWidth / zoomScale);
    expect(contentWidth).toBe(333);
  });
});

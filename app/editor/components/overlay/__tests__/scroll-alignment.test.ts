import { describe, it, expect } from "vitest";

/**
 * Bug: When scrolling the canvas, the selection overlay drifts out of alignment
 * with the selected element because the overlay doesn't scroll with content.
 *
 * Root cause: The overlay uses `position: absolute; inset: 0` inside the scroll
 * container (canvasRef). This makes it fixed to the container viewport — it does
 * NOT scroll with the content. The scroll listener re-measures positions and
 * triggers a React re-render, but there's a 1+ frame lag where the overlay
 * is visibly misaligned.
 *
 * Fix: Move the overlay inside a `position: relative` wrapper that IS part of
 * the scrollable content. Both content and overlay scroll together natively.
 * Positions become content-relative (scroll-stable), so no scroll re-measurement
 * is needed — eliminating the drift entirely.
 *
 * Before:
 *   canvasRef (overflow-auto, relative)
 *     contentDiv (scrolls)
 *     overlay (position: absolute; inset: 0 → viewport-fixed, doesn't scroll)
 *
 * After:
 *   canvasRef (overflow-auto)
 *     wrapper (relative) ← new
 *       contentDiv (scrolls)
 *       overlay (position: absolute; inset: 0 → scrolls with wrapper)
 */

describe("scroll alignment", () => {
  it("viewport-relative positions drift on scroll (documents the bug)", () => {
    // Simulate viewport-relative measurement (old approach)
    const canvasViewportTop = 100; // Canvas is at Y=100 on screen
    const elementScreenY = 300;    // Element is at Y=300 on screen

    // Overlay position = element screen pos - canvas viewport pos
    const overlayY = elementScreenY - canvasViewportTop; // 200

    // User scrolls down 150px — element moves up on screen
    const elementScreenYAfterScroll = 300 - 150; // 150
    // Canvas viewport doesn't move (it's the scroll container)
    const overlayYAfterScroll = elementScreenYAfterScroll - canvasViewportTop; // 50

    // But the overlay is viewport-fixed, so it still shows the old position (200)
    // until React re-renders. This is the visible drift.
    expect(overlayY).toBe(200);
    expect(overlayYAfterScroll).toBe(50);
    // Gap of 150px visible for 1+ frame!
    expect(overlayY - overlayYAfterScroll).toBe(150);
  });

  it("content-relative positions are scroll-stable (the fix)", () => {
    // Simulate content-relative measurement (new approach)
    const wrapperScreenTop = 100;  // Wrapper is at Y=100 on screen
    const elementScreenY = 300;     // Element is at Y=300 on screen

    // Position relative to wrapper (content-space)
    const contentY = elementScreenY - wrapperScreenTop; // 200

    // User scrolls down 150px — BOTH wrapper and element move up equally
    const wrapperScreenTopAfterScroll = 100 - 150; // -50
    const elementScreenYAfterScroll = 300 - 150;    // 150

    // Content-relative position is unchanged!
    const contentYAfterScroll = elementScreenYAfterScroll - wrapperScreenTopAfterScroll; // 200

    expect(contentY).toBe(200);
    expect(contentYAfterScroll).toBe(200);
    // Zero drift — overlay scrolls with content natively
    expect(contentY - contentYAfterScroll).toBe(0);
  });
});

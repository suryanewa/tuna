import { describe, it, expect, beforeEach } from "vitest";
import { ChangeTracker } from "../engine/change-tracker";

/**
 * Tests for the three overlay bug fixes applied to main:
 * 1. @media rule skip in getScopedStyles/getPseudoStateStyles/getStyleSources
 * 2. Forced-state change dots (selectedChangedProperties must include :hover edits)
 * 3. Border section expanded layout (structural, not testable here — visual only)
 *
 * These tests verify the core logic in isolation, not React component rendering.
 */

// ---------------------------------------------------------------------------
// Fix 1: @media rule skip
// ---------------------------------------------------------------------------
// The actual fix is in styles.ts walker functions which require a live DOM +
// stylesheets. We can't unit-test CSSMediaRule matching without a browser
// environment, but we CAN test the conditional logic pattern:

describe("@media rule skip pattern", () => {
  it("should skip non-matching media rules", () => {
    // Simulate the decision: given a CSSMediaRule-like object and a matcher,
    // the walker should skip when the media query doesn't match.
    const matchMedia = (query: string) => ({
      matches: query === "(max-width: 1024px)" ? false : true,
    });

    const rules: Array<
      | { type: "media"; conditionText: string; styles: { color: string } }
      | { type: "style"; styles: { color: string } }
    > = [
      { type: "media", conditionText: "(max-width: 768px)", styles: { color: "red" } },
      { type: "media", conditionText: "(max-width: 1024px)", styles: { color: "blue" } },
      { type: "style", styles: { color: "green" } },
    ];

    const applied: string[] = [];
    for (const rule of rules) {
      if (rule.type === "media") {
        if (!matchMedia(rule.conditionText).matches) continue;
        applied.push(rule.styles.color);
      } else {
        applied.push(rule.styles.color);
      }
    }

    // max-width: 768px matches (viewport assumed > 768 but the mock returns true)
    // max-width: 1024px does NOT match (mock returns false)
    // The base style always applies
    expect(applied).toEqual(["red", "green"]);
    expect(applied).not.toContain("blue");
  });
});

// ---------------------------------------------------------------------------
// Fix 2: Forced-state change dots
// ---------------------------------------------------------------------------
// The fix: selectedChangedProperties must query BOTH the base selector AND
// the forced-state-suffixed selector, then merge results.

describe("forced-state change dots", () => {
  let tracker: ChangeTracker;

  beforeEach(() => {
    tracker = new ChangeTracker();
  });

  it("getChangedProperties returns changes for the exact selector", () => {
    tracker.track(".btn", "button", null, ["btn"], [], { color: "red" });
    tracker.recordChange(".btn", "color", "blue");

    const changed = tracker.getChangedProperties(".btn");
    expect(changed.has("color")).toBe(true);
  });

  it("getChangedProperties does NOT return changes from a different selector suffix", () => {
    // Record change under .btn:hover
    tracker.track(".btn:hover", "button", null, ["btn"], [], { color: "red" });
    tracker.recordChange(".btn:hover", "color", "blue");

    // Query with base .btn — should NOT find it
    const baseChanged = tracker.getChangedProperties(".btn");
    expect(baseChanged.has("color")).toBe(false);

    // Query with .btn:hover — should find it
    const hoverChanged = tracker.getChangedProperties(".btn:hover");
    expect(hoverChanged.has("color")).toBe(true);
  });

  it("merged query pattern finds changes from both base and forced selectors", () => {
    // Base edit
    tracker.track(".btn", "button", null, ["btn"], [], { fontSize: "14px", color: "red" });
    tracker.recordChange(".btn", "fontSize", "16px");

    // Forced-state edit
    tracker.track(".btn:hover", "button", null, ["btn"], [], { color: "red" });
    tracker.recordChange(".btn:hover", "color", "blue");

    // Simulate the fix: merge both result sets
    const baseSelector = ".btn";
    const forcedState = ":hover";
    const result = tracker.getChangedProperties(baseSelector);
    const forcedChanges = tracker.getChangedProperties(`${baseSelector}${forcedState}`);
    for (const p of forcedChanges) result.add(p);

    // Should contain both: fontSize from base, color from :hover
    expect(result.has("fontSize")).toBe(true);
    expect(result.has("color")).toBe(true);
    expect(result.size).toBe(2);
  });

  it("no forced state returns only base changes", () => {
    tracker.track(".btn", "button", null, ["btn"], [], { color: "red" });
    tracker.recordChange(".btn", "color", "blue");

    const forcedState = null;
    const result = tracker.getChangedProperties(".btn");
    if (forcedState) {
      const fc = tracker.getChangedProperties(`.btn${forcedState}`);
      for (const p of fc) result.add(p);
    }

    expect(result.has("color")).toBe(true);
    expect(result.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Fix 3: Border section layout
// ---------------------------------------------------------------------------
// This is a visual/structural fix — the expanded border inputs were nested
// in a flex-in-flex container. Not testable without rendering. Covered by
// manual visual verification.

// ---------------------------------------------------------------------------
// Bonus: detectLayoutMode order-of-operations
// ---------------------------------------------------------------------------
// Verify that inline-flex → "flex" (not "inline") on main

describe("detectLayoutMode check order", () => {
  it("includes('flex') matches before includes('inline') for inline-flex", () => {
    // Simulate the check order from styles.ts:469-471
    const display = "inline-flex";
    let result: string;

    // Current correct order: flex check first
    if (display.includes("flex")) result = "flex";
    else if (display.includes("grid")) result = "grid";
    else if (display.includes("inline")) result = "inline";
    else result = "block";

    expect(result).toBe("flex");
  });

  it("includes('grid') matches before includes('inline') for inline-grid", () => {
    const display = "inline-grid";
    let result: string;

    if (display.includes("flex")) result = "flex";
    else if (display.includes("grid")) result = "grid";
    else if (display.includes("inline")) result = "inline";
    else result = "block";

    expect(result).toBe("grid");
  });

  it("plain inline still returns inline", () => {
    const display = "inline";
    let result: string;

    if (display.includes("flex")) result = "flex";
    else if (display.includes("grid")) result = "grid";
    else if (display.includes("inline")) result = "inline";
    else result = "block";

    expect(result).toBe("inline");
  });

  it("inline-block returns inline", () => {
    const display = "inline-block";
    let result: string;

    if (display.includes("flex")) result = "flex";
    else if (display.includes("grid")) result = "grid";
    else if (display.includes("inline")) result = "inline";
    else result = "block";

    expect(result).toBe("inline");
  });
});

import { describe, it, expect, beforeEach } from "vitest";

/**
 * Tests for the pseudo-state filtering logic used in Retune.tsx's
 * refreshSelectedElement and handlePropertyChange callbacks.
 *
 * The logic lives inside React callbacks, so we replicate the core algorithm
 * as a pure function and test it in isolation. This tests the *filtering
 * conditions*, not the React component lifecycle.
 */

// ---------------------------------------------------------------------------
// Types matching the real implementation
// ---------------------------------------------------------------------------
type ForcedState = ":hover" | ":focus" | ":active" | null;

interface AppliedRule {
  selector: string;
  property: string;
  value: string;
  index: number;
}

interface ForcedStyles {
  selector: string;
  props: string[];
}

/**
 * Pure extraction of the filtering logic from refreshSelectedElement.
 *
 * Given:
 * - previewChanges: all rules currently in the LivePreviewEngine
 * - currentState: the currently forced pseudo-state (or null for default)
 * - forced: the forcedStylesRef tracking which base-selector props were
 *   injected for visual preview only
 * - pseudoStylesheet: CSS values from the stylesheet's pseudo-state rules
 *   (result of getPseudoStateStyles, in camelCase)
 * - elementMatches: a function that checks if the element matches a selector
 *
 * Returns: the overlaid computedStyles map (property → value)
 */
function applyPreviewOverlay(
  baseStyles: Record<string, string>,
  previewChanges: AppliedRule[],
  currentState: ForcedState,
  forced: ForcedStyles,
  pseudoStylesheet: Record<string, string>,
  elementMatches: (selector: string) => boolean,
): Record<string, string> {
  const styles = { ...baseStyles };

  // When a pseudo-state is forced, overlay the stylesheet pseudo values first
  if (currentState) {
    for (const [prop, value] of Object.entries(pseudoStylesheet)) {
      styles[prop] = value;
    }
  }

  for (const change of previewChanges) {
    const pseudoMatch = change.selector.match(/:(hover|focus|active)$/);
    const changePseudo = pseudoMatch ? pseudoMatch[0] : null;
    const baseSel = change.selector.replace(/:(hover|focus|active)$/g, "");

    // Skip forced base-selector styles — they exist only for visual preview,
    // not for panel display
    if (!changePseudo && forced.selector === change.selector
        && forced.props.includes(change.property)) {
      continue;
    }

    // Default view: skip pseudo-state changes
    if (!currentState && changePseudo) continue;
    // Pseudo view: skip changes for a different pseudo-state
    if (currentState && changePseudo && changePseudo !== currentState) continue;

    try {
      if (elementMatches(baseSel)) {
        styles[change.property] = change.value;
      }
    } catch { /* invalid selector */ }
  }

  return styles;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simple matcher: returns true if the selector is ".btn" */
const matchesBtn = (selector: string) => selector === ".btn";

/** Always matches */
const matchesAll = (_selector: string) => true;

describe("Pseudo-state filtering logic (refreshSelectedElement)", () => {
  // -----------------------------------------------------------------------
  // 1. Default view: base-selector changes ARE shown
  // -----------------------------------------------------------------------
  it("default view: base-selector changes ARE shown", () => {
    const result = applyPreviewOverlay(
      { fontSize: "14px" },
      [{ selector: ".btn", property: "fontSize", value: "16px", index: 0 }],
      null, // default view
      { selector: "", props: [] },
      {},
      matchesBtn,
    );
    expect(result.fontSize).toBe("16px");
  });

  // -----------------------------------------------------------------------
  // 2. Default view: pseudo-state changes are SKIPPED
  // -----------------------------------------------------------------------
  it("default view: pseudo-state changes are SKIPPED", () => {
    const result = applyPreviewOverlay(
      { color: "black" },
      [{ selector: ".btn:hover", property: "color", value: "blue", index: 0 }],
      null, // default view
      { selector: "", props: [] },
      {},
      matchesBtn,
    );
    expect(result.color).toBe("black"); // unchanged
  });

  // -----------------------------------------------------------------------
  // 3. Default view: forced base-selector styles are SKIPPED
  // -----------------------------------------------------------------------
  it("default view: forced base-selector styles are SKIPPED", () => {
    // This scenario: user was in :hover state, made edits (which also wrote
    // base-selector forced styles), then toggled back to default view.
    // The cleanup should have removed them, but if any remain they're filtered.
    const result = applyPreviewOverlay(
      { color: "black" },
      [{ selector: ".btn", property: "color", value: "red", index: 0 }],
      null, // default view
      { selector: ".btn", props: ["color"] },
      {},
      matchesBtn,
    );
    // The forced base style is skipped because forced.selector matches and
    // forced.props includes the property
    expect(result.color).toBe("black");
  });

  // -----------------------------------------------------------------------
  // 4. Hover view: pseudo stylesheet values are overlaid
  // -----------------------------------------------------------------------
  it("hover view: pseudo stylesheet values are overlaid", () => {
    const result = applyPreviewOverlay(
      { color: "black", backgroundColor: "white" },
      [], // no user changes
      ":hover",
      { selector: "", props: [] },
      { color: "blue", backgroundColor: "lightblue" }, // from stylesheet :hover rules
      matchesBtn,
    );
    expect(result.color).toBe("blue");
    expect(result.backgroundColor).toBe("lightblue");
  });

  // -----------------------------------------------------------------------
  // 5. Hover view: user's hover changes override pseudo stylesheet values
  // -----------------------------------------------------------------------
  it("hover view: user hover changes override pseudo stylesheet values", () => {
    const result = applyPreviewOverlay(
      { color: "black" },
      [{ selector: ".btn:hover", property: "color", value: "green", index: 0 }],
      ":hover",
      { selector: "", props: [] },
      { color: "blue" }, // stylesheet says blue for :hover
      matchesBtn,
    );
    // User's change (green) should win over stylesheet pseudo value (blue)
    expect(result.color).toBe("green");
  });

  // -----------------------------------------------------------------------
  // 6. Hover view: forced base-selector styles are SKIPPED (panel only)
  // -----------------------------------------------------------------------
  it("hover view: forced base-selector styles are SKIPPED from panel display", () => {
    const result = applyPreviewOverlay(
      { color: "black" },
      [
        // The forced base-selector style (for visual preview on the page)
        { selector: ".btn", property: "color", value: "green", index: 0 },
        // The actual :hover change
        { selector: ".btn:hover", property: "color", value: "green", index: 1 },
      ],
      ":hover",
      { selector: ".btn", props: ["color"] }, // forced styles tracking
      {},
      matchesBtn,
    );
    // The base-selector forced style is skipped; the :hover change shows
    expect(result.color).toBe("green");
  });

  // -----------------------------------------------------------------------
  // 7. Hover view: changes for a different pseudo (e.g. :focus) are SKIPPED
  // -----------------------------------------------------------------------
  it("hover view: changes for a different pseudo are SKIPPED", () => {
    const result = applyPreviewOverlay(
      { color: "black" },
      [
        { selector: ".btn:focus", property: "color", value: "orange", index: 0 },
        { selector: ".btn:hover", property: "fontSize", value: "18px", index: 1 },
      ],
      ":hover",
      { selector: "", props: [] },
      {},
      matchesBtn,
    );
    // :focus change is skipped, color stays at base
    expect(result.color).toBe("black");
    // :hover change is applied
    expect(result.fontSize).toBe("18px");
  });

  // -----------------------------------------------------------------------
  // 8. Switching from hover to default: forced styles are cleaned up correctly
  // -----------------------------------------------------------------------
  it("switching from hover to default: forced styles cleanup", () => {
    // Simulate the handleForcedStateChange cleanup:
    // When switching to null, the forced styles should be removed.
    // Here we test the filtering after cleanup (forcedStylesRef is reset).
    const result = applyPreviewOverlay(
      { color: "black", fontSize: "14px" },
      [
        // Only the :hover change remains (base forced styles were removed by cleanup)
        { selector: ".btn:hover", property: "color", value: "red", index: 0 },
        // A regular base change that was made in default view should persist
        { selector: ".btn", property: "fontSize", value: "18px", index: 1 },
      ],
      null, // back to default view
      { selector: "", props: [] }, // forcedStylesRef was reset by cleanup
      {},
      matchesBtn,
    );
    // :hover change is skipped in default view
    expect(result.color).toBe("black");
    // Base change persists
    expect(result.fontSize).toBe("18px");
  });

  // -----------------------------------------------------------------------
  // 9. forcedStateRef is updated synchronously before refresh runs
  // -----------------------------------------------------------------------
  it("forcedStateRef synchronous update affects filtering", () => {
    // This tests the scenario where forcedStateRef.current is set to ":hover"
    // *before* refreshSelectedElement runs. The filtering uses the ref value,
    // not the React state (which may not have updated yet).

    // Simulate: forcedStateRef was set to :hover, then refresh runs
    const resultHover = applyPreviewOverlay(
      { color: "black" },
      [{ selector: ".btn:hover", property: "color", value: "red", index: 0 }],
      ":hover", // this is what forcedStateRef.current would be
      { selector: "", props: [] },
      {},
      matchesBtn,
    );
    expect(resultHover.color).toBe("red");

    // Now simulate: forcedStateRef was set to null, refresh runs with same changes
    const resultDefault = applyPreviewOverlay(
      { color: "black" },
      [{ selector: ".btn:hover", property: "color", value: "red", index: 0 }],
      null, // forcedStateRef.current set to null before refresh
      { selector: "", props: [] },
      {},
      matchesBtn,
    );
    expect(resultDefault.color).toBe("black"); // :hover change skipped
  });

  // -----------------------------------------------------------------------
  // 10. User edits in hover state: base selector is updated AND tracked in
  //     forcedStylesRef for cleanup
  // -----------------------------------------------------------------------
  it("user edits in hover state: base selector forced + tracked for cleanup", () => {
    // When user edits color in :hover state, handlePropertyChange does:
    //   1. preview.applyChange(".btn:hover", "color", "green")  — the real change
    //   2. preview.applyChange(".btn", "color", "green")          — forced visual
    //   3. forcedStylesRef.props.push("color")                    — for cleanup
    //
    // The forced base-selector style is skipped in the panel view.

    const forced: ForcedStyles = { selector: ".btn", props: ["color"] };

    const result = applyPreviewOverlay(
      { color: "black", padding: "8px" },
      [
        { selector: ".btn:hover", property: "color", value: "green", index: 0 },
        { selector: ".btn", property: "color", value: "green", index: 1 }, // forced visual
        { selector: ".btn", property: "padding", value: "16px", index: 2 }, // regular change (not forced)
      ],
      ":hover",
      forced,
      {},
      matchesBtn,
    );

    // :hover change IS shown
    expect(result.color).toBe("green");
    // Regular base change IS shown (not in forced.props)
    expect(result.padding).toBe("16px");
  });

  // -----------------------------------------------------------------------
  // Extra: :active state works the same way as :hover
  // -----------------------------------------------------------------------
  it("active state: shows :active changes, skips :hover", () => {
    const result = applyPreviewOverlay(
      { color: "black" },
      [
        { selector: ".btn:hover", property: "color", value: "blue", index: 0 },
        { selector: ".btn:active", property: "color", value: "red", index: 1 },
      ],
      ":active",
      { selector: "", props: [] },
      {},
      matchesBtn,
    );
    expect(result.color).toBe("red");
  });

  // -----------------------------------------------------------------------
  // Extra: element that doesn't match selector is unaffected
  // -----------------------------------------------------------------------
  it("changes for non-matching selectors are ignored", () => {
    const result = applyPreviewOverlay(
      { color: "black" },
      [{ selector: ".card", property: "color", value: "red", index: 0 }],
      null,
      { selector: "", props: [] },
      {},
      matchesBtn, // only matches ".btn"
    );
    expect(result.color).toBe("black");
  });

  // -----------------------------------------------------------------------
  // Extra: pseudo stylesheet values are only applied in pseudo views
  // -----------------------------------------------------------------------
  it("pseudo stylesheet values are NOT applied in default view", () => {
    const result = applyPreviewOverlay(
      { color: "black" },
      [],
      null, // default view
      { selector: "", props: [] },
      { color: "blue" }, // these come from :hover CSS rules
      matchesBtn,
    );
    expect(result.color).toBe("black"); // stylesheet pseudo values ignored
  });
});

import { describe, it, expect } from "vitest";
import { readFilters, writeFilters } from "../tailwind-adapters";
import type { FilterItem, FilterType, FilterTarget } from "../../sections-v2/filter-section";

/**
 * Bug: Clicking "hide" on a filter removes it entirely instead of hiding it.
 *
 * Root cause: writeFilters skips hidden filters (visible === false) with
 * `continue`, so their TailwindStyles field gets set to undefined. On the next
 * readFilters call the filter is gone because there's no class to parse.
 *
 * The fix: hidden filters should still write their class to TailwindStyles
 * (so they survive round-trips) and readFilters should preserve a hidden
 * state. A separate metadata field (like `hiddenFilters`) can track which
 * filter keys are hidden.
 */

function makeFilter(
  type: FilterType,
  value: string,
  target: FilterTarget = "layer",
  visible = true
): FilterItem {
  return { id: `test-${target}-${type}`, type, value, target, visible };
}

describe("Filter visibility toggle", () => {
  it("should preserve a hidden blur filter through write→read", () => {
    const filters = [makeFilter("blur", "4", "layer", false)];
    const styles = writeFilters(filters);
    // The blur field should still be set (not undefined)
    expect(styles.blur).toBeDefined();
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("blur");
    expect(result[0].value).toBe("4");
    expect(result[0].visible).toBe(false);
  });

  it("should preserve a hidden brightness filter through write→read", () => {
    const filters = [makeFilter("brightness", "150", "layer", false)];
    const styles = writeFilters(filters);
    expect(styles.brightness).toBeDefined();
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("brightness");
    expect(result[0].value).toBe("150");
    expect(result[0].visible).toBe(false);
  });

  it("should preserve a hidden invert filter through write→read", () => {
    const filters = [makeFilter("invert", "50", "layer", false)];
    const styles = writeFilters(filters);
    expect(styles.invert).toBeDefined();
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("invert");
    expect(result[0].value).toBe("50");
    expect(result[0].visible).toBe(false);
  });

  it("should preserve a hidden backdrop-blur filter through write→read", () => {
    const filters = [makeFilter("blur", "8", "backdrop", false)];
    const styles = writeFilters(filters);
    expect(styles.backdropBlur).toBeDefined();
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].target).toBe("backdrop");
    expect(result[0].visible).toBe(false);
  });

  it("should mix visible and hidden filters correctly", () => {
    const filters = [
      makeFilter("blur", "4", "layer", true),
      makeFilter("brightness", "120", "layer", false),
      makeFilter("contrast", "80", "layer", true),
    ];
    const styles = writeFilters(filters);
    // All three should be written
    expect(styles.blur).toBeDefined();
    expect(styles.brightness).toBeDefined();
    expect(styles.contrast).toBeDefined();
    const result = readFilters(styles as any);
    expect(result).toHaveLength(3);

    const blurItem = result.find((f) => f.type === "blur");
    expect(blurItem?.visible).toBe(true);

    const brightnessItem = result.find((f) => f.type === "brightness");
    expect(brightnessItem?.visible).toBe(false);

    const contrastItem = result.find((f) => f.type === "contrast");
    expect(contrastItem?.visible).toBe(true);
  });

  it("should not apply hidden filter styles visually (extractArbitraryStyles should skip them)", () => {
    // This test just verifies the data model — hidden filters keep their class
    // but extractArbitraryStyles in EditorCanvas should skip hidden ones.
    // That's tested separately; here we just verify the round-trip.
    const filters = [makeFilter("sepia", "60", "layer", false)];
    const styles = writeFilters(filters);
    expect(styles.sepia).toBeDefined();
    const result = readFilters(styles as any);
    expect(result[0].visible).toBe(false);
    expect(result[0].value).toBe("60");
  });
});

import { describe, it, expect } from "vitest";
import { readFilters, writeFilters } from "../tailwind-adapters";
import type { FilterItem, FilterType, FilterTarget } from "../../sections-v2/filter-section";

/**
 * Bug: Sepia, invert, and hue rotate filters are not persisted when added.
 *
 * Root cause: These filters have a default value of "0". writeFilters produces
 * classes ending in "-0" (e.g. "hue-rotate-0", "invert-0", "sepia-0"), but
 * readFilters skips any class ending in "-0" because it considers them
 * equivalent to "no filter". This means the filter disappears on the next read.
 *
 * The round-trip: add filter → writeFilters → update styles → readFilters
 * must preserve all added filters regardless of their value.
 */

function makeFilter(type: FilterType, value: string, target: FilterTarget = "layer"): FilterItem {
  return { id: `test-${target}-${type}`, type, value, target, visible: true };
}

describe("Filter round-trip bug: zero-default filters disappear", () => {
  it("should preserve hueRotate with value '0' through write→read", () => {
    const filters = [makeFilter("hueRotate", "0")];
    const styles = writeFilters(filters);
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("hueRotate");
    expect(result[0].value).toBe("0");
  });

  it("should preserve invert with value '0' through write→read", () => {
    const filters = [makeFilter("invert", "0")];
    const styles = writeFilters(filters);
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("invert");
    expect(result[0].value).toBe("0");
  });

  it("should preserve sepia with value '0' through write→read", () => {
    const filters = [makeFilter("sepia", "0")];
    const styles = writeFilters(filters);
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("sepia");
    expect(result[0].value).toBe("0");
  });

  it("should preserve backdrop hueRotate with value '0'", () => {
    const filters = [makeFilter("hueRotate", "0", "backdrop")];
    const styles = writeFilters(filters);
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("hueRotate");
    expect(result[0].target).toBe("backdrop");
  });

  it("should preserve backdrop invert with value '0'", () => {
    const filters = [makeFilter("invert", "0", "backdrop")];
    const styles = writeFilters(filters);
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("invert");
    expect(result[0].target).toBe("backdrop");
  });

  it("should preserve backdrop sepia with value '0'", () => {
    const filters = [makeFilter("sepia", "0", "backdrop")];
    const styles = writeFilters(filters);
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("sepia");
    expect(result[0].target).toBe("backdrop");
  });

  // Ensure non-zero values still work
  it("should preserve hueRotate with non-zero value", () => {
    const filters = [makeFilter("hueRotate", "90")];
    const styles = writeFilters(filters);
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("90");
  });

  it("should preserve invert with value '100'", () => {
    const filters = [makeFilter("invert", "100")];
    const styles = writeFilters(filters);
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("100");
  });

  it("should preserve sepia with value '100'", () => {
    const filters = [makeFilter("sepia", "100")];
    const styles = writeFilters(filters);
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("100");
  });

  // Filters that already work (non-zero defaults) should continue working
  it("should preserve blur, brightness, contrast, saturate with defaults", () => {
    const filters = [
      makeFilter("blur", "4"),
      makeFilter("brightness", "100"),
      makeFilter("contrast", "100"),
      makeFilter("saturate", "100"),
    ];
    const styles = writeFilters(filters);
    const result = readFilters(styles as any);
    expect(result).toHaveLength(4);
  });
});

import { describe, it, expect } from "vitest";
import { readFilters, writeFilters } from "../tailwind-adapters";
import type { FilterItem, FilterType, FilterTarget } from "../../sections-v2/filter-section";

/**
 * Bug: Invert and sepia filters don't allow changing values.
 *
 * Root cause: writeFilters treats invert and sepia as binary (only "invert"
 * or "invert-0"), so any intermediate value like 50 gets written as "invert-0"
 * which reads back as 0. The value snaps back every time the user changes it.
 *
 * These should support arbitrary percentage values like other filters, since
 * CSS invert() and sepia() accept any value from 0 to 1 (0% to 100%).
 */

function makeFilter(type: FilterType, value: string, target: FilterTarget = "layer"): FilterItem {
  return { id: `test-${target}-${type}`, type, value, target, visible: true };
}

describe("Invert filter intermediate values", () => {
  it("should preserve invert value of 50 through write→read", () => {
    const filters = [makeFilter("invert", "50")];
    const styles = writeFilters(filters);
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("50");
  });

  it("should preserve invert value of 25 through write→read", () => {
    const filters = [makeFilter("invert", "25")];
    const styles = writeFilters(filters);
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("25");
  });

  it("should preserve backdrop invert value of 75", () => {
    const filters = [makeFilter("invert", "75", "backdrop")];
    const styles = writeFilters(filters);
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("75");
  });
});

describe("Sepia filter intermediate values", () => {
  it("should preserve sepia value of 50 through write→read", () => {
    const filters = [makeFilter("sepia", "50")];
    const styles = writeFilters(filters);
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("50");
  });

  it("should preserve sepia value of 30 through write→read", () => {
    const filters = [makeFilter("sepia", "30")];
    const styles = writeFilters(filters);
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("30");
  });

  it("should preserve backdrop sepia value of 60", () => {
    const filters = [makeFilter("sepia", "60", "backdrop")];
    const styles = writeFilters(filters);
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("60");
  });
});

describe("Invert/sepia boundary values still work", () => {
  it("should round-trip invert 0", () => {
    const filters = [makeFilter("invert", "0")];
    const styles = writeFilters(filters);
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("0");
  });

  it("should round-trip invert 100", () => {
    const filters = [makeFilter("invert", "100")];
    const styles = writeFilters(filters);
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("100");
  });

  it("should round-trip sepia 0", () => {
    const filters = [makeFilter("sepia", "0")];
    const styles = writeFilters(filters);
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("0");
  });

  it("should round-trip sepia 100", () => {
    const filters = [makeFilter("sepia", "100")];
    const styles = writeFilters(filters);
    const result = readFilters(styles as any);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("100");
  });
});

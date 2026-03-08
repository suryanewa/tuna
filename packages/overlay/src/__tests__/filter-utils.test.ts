import { describe, it, expect } from "vitest";
import { parseFilters, filtersToCss, defaultFilter, FILTER_CONFIG } from "../ui/filter-utils";

describe("parseFilters", () => {
  it("returns empty array for none", () => {
    expect(parseFilters("none", "none")).toEqual([]);
  });

  it("returns empty array for empty strings", () => {
    expect(parseFilters("", "")).toEqual([]);
  });

  it("parses single layer filter", () => {
    const result = parseFilters("blur(4px)", "none");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("blur");
    expect(result[0].value).toBe(4);
    expect(result[0].target).toBe("layer");
  });

  it("parses multiple layer filters", () => {
    const result = parseFilters("blur(4px) brightness(120%)", "none");
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("blur");
    expect(result[1].type).toBe("brightness");
    expect(result[1].value).toBe(120);
  });

  it("parses backdrop filters", () => {
    const result = parseFilters("none", "blur(8px)");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("blur");
    expect(result[0].target).toBe("backdrop");
  });

  it("parses both layer and backdrop filters", () => {
    const result = parseFilters("contrast(150%)", "blur(4px)");
    expect(result).toHaveLength(2);
    expect(result[0].target).toBe("layer");
    expect(result[1].target).toBe("backdrop");
  });

  it("parses hue-rotate", () => {
    const result = parseFilters("hue-rotate(90deg)", "none");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("hue-rotate");
    expect(result[0].value).toBe(90);
  });
});

describe("filtersToCss", () => {
  it("returns none for empty array", () => {
    const result = filtersToCss([]);
    expect(result.filter).toBe("none");
    expect(result.backdropFilter).toBe("none");
  });

  it("serializes layer filters", () => {
    const items = [
      { id: "1", type: "blur" as const, value: 4, target: "layer" as const },
    ];
    const result = filtersToCss(items);
    expect(result.filter).toBe("blur(4px)");
    expect(result.backdropFilter).toBe("none");
  });

  it("serializes backdrop filters", () => {
    const items = [
      { id: "1", type: "blur" as const, value: 8, target: "backdrop" as const },
    ];
    const result = filtersToCss(items);
    expect(result.filter).toBe("none");
    expect(result.backdropFilter).toBe("blur(8px)");
  });

  it("serializes multiple filters with correct units", () => {
    const items = [
      { id: "1", type: "blur" as const, value: 4, target: "layer" as const },
      { id: "2", type: "brightness" as const, value: 120, target: "layer" as const },
    ];
    const result = filtersToCss(items);
    expect(result.filter).toBe("blur(4px) brightness(120%)");
  });

  it("separates layer and backdrop correctly", () => {
    const items = [
      { id: "1", type: "contrast" as const, value: 150, target: "layer" as const },
      { id: "2", type: "blur" as const, value: 4, target: "backdrop" as const },
    ];
    const result = filtersToCss(items);
    expect(result.filter).toBe("contrast(150%)");
    expect(result.backdropFilter).toBe("blur(4px)");
  });
});

describe("defaultFilter", () => {
  it("creates filter with correct default value", () => {
    const f = defaultFilter("blur", "layer");
    expect(f.type).toBe("blur");
    expect(f.value).toBe(FILTER_CONFIG.blur.defaultValue);
    expect(f.target).toBe("layer");
    expect(f.id).toBeTruthy();
  });

  it("creates backdrop filter", () => {
    const f = defaultFilter("brightness", "backdrop");
    expect(f.target).toBe("backdrop");
    expect(f.value).toBe(100);
  });
});

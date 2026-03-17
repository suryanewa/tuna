import { describe, it, expect } from "vitest";
import {
  getCategoryForProperty,
  getPropertiesForCategory,
  getCategoryForCamelProp,
} from "../tokens/categories";

describe("getCategoryForProperty", () => {
  it("maps padding properties to spacing", () => {
    expect(getCategoryForProperty("padding")).toBe("spacing");
    expect(getCategoryForProperty("padding-top")).toBe("spacing");
    expect(getCategoryForProperty("padding-left")).toBe("spacing");
  });

  it("maps margin properties to spacing", () => {
    expect(getCategoryForProperty("margin")).toBe("spacing");
    expect(getCategoryForProperty("margin-bottom")).toBe("spacing");
  });

  it("maps gap properties to spacing", () => {
    expect(getCategoryForProperty("gap")).toBe("spacing");
    expect(getCategoryForProperty("row-gap")).toBe("spacing");
    expect(getCategoryForProperty("column-gap")).toBe("spacing");
  });

  it("maps sizing properties", () => {
    expect(getCategoryForProperty("width")).toBe("sizing");
    expect(getCategoryForProperty("height")).toBe("sizing");
    expect(getCategoryForProperty("min-width")).toBe("sizing");
    expect(getCategoryForProperty("max-height")).toBe("sizing");
  });

  it("maps color properties", () => {
    expect(getCategoryForProperty("color")).toBe("colors");
    expect(getCategoryForProperty("background-color")).toBe("colors");
    expect(getCategoryForProperty("border-color")).toBe("colors");
    expect(getCategoryForProperty("outline-color")).toBe("colors");
  });

  it("maps typography properties to per-property categories", () => {
    expect(getCategoryForProperty("font-size")).toBe("font-size");
    expect(getCategoryForProperty("font-weight")).toBe("font-weight");
    expect(getCategoryForProperty("line-height")).toBe("line-height");
    expect(getCategoryForProperty("letter-spacing")).toBe("letter-spacing");
    expect(getCategoryForProperty("font-family")).toBe("font-family");
  });

  it("maps border properties", () => {
    expect(getCategoryForProperty("border-radius")).toBe("borders");
    expect(getCategoryForProperty("border-top-left-radius")).toBe("borders");
    expect(getCategoryForProperty("border-width")).toBe("borders");
  });

  it("maps effect properties", () => {
    expect(getCategoryForProperty("box-shadow")).toBe("effects");
    expect(getCategoryForProperty("opacity")).toBe("effects");
  });

  it("maps layout properties", () => {
    expect(getCategoryForProperty("display")).toBe("layout");
    expect(getCategoryForProperty("flex-direction")).toBe("layout");
    expect(getCategoryForProperty("align-items")).toBe("layout");
    expect(getCategoryForProperty("justify-content")).toBe("layout");
  });

  it("returns null for unknown properties", () => {
    expect(getCategoryForProperty("transform")).toBeNull();
    expect(getCategoryForProperty("animation")).toBeNull();
    expect(getCategoryForProperty("")).toBeNull();
  });
});

describe("getPropertiesForCategory", () => {
  it("returns spacing properties", () => {
    const props = getPropertiesForCategory("spacing");
    expect(props).toContain("padding");
    expect(props).toContain("margin");
    expect(props).toContain("gap");
    expect(props).not.toContain("width");
  });

  it("returns color properties", () => {
    const props = getPropertiesForCategory("colors");
    expect(props).toContain("color");
    expect(props).toContain("background-color");
    expect(props).not.toContain("width");
  });

  it("returns empty array for non-existent category", () => {
    expect(getPropertiesForCategory("nonexistent" as any)).toEqual([]);
  });
});

describe("getCategoryForCamelProp", () => {
  it("converts camelCase to kebab-case and looks up", () => {
    expect(getCategoryForCamelProp("paddingTop")).toBe("spacing");
    expect(getCategoryForCamelProp("fontSize")).toBe("font-size");
    expect(getCategoryForCamelProp("backgroundColor")).toBe("colors");
    expect(getCategoryForCamelProp("borderRadius")).toBe("borders");
  });

  it("handles already-kebab properties", () => {
    // No uppercase letters means no conversion needed
    expect(getCategoryForCamelProp("gap")).toBe("spacing");
    expect(getCategoryForCamelProp("opacity")).toBe("effects");
  });

  it("returns null for unknown camelCase props", () => {
    expect(getCategoryForCamelProp("transform")).toBeNull();
  });
});

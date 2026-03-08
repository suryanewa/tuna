import { describe, it, expect } from "vitest";
import { collapseShorthands } from "../engine/output";
import type { PropertyChange } from "../types";

function makeChange(property: string, from: string, to: string): PropertyChange {
  return { property, from, to };
}

describe("collapseShorthands", () => {
  it("collapses all 4 padding longhands into shorthand", () => {
    const changes = [
      makeChange("paddingTop", "8px", "16px"),
      makeChange("paddingRight", "8px", "16px"),
      makeChange("paddingBottom", "8px", "16px"),
      makeChange("paddingLeft", "8px", "16px"),
    ];
    const result = collapseShorthands(changes);
    expect(result).toHaveLength(1);
    expect(result[0].property).toBe("padding");
    expect(result[0].from).toBe("8px");
    expect(result[0].to).toBe("16px");
  });

  it("does not collapse when values differ", () => {
    const changes = [
      makeChange("paddingTop", "8px", "16px"),
      makeChange("paddingRight", "8px", "12px"),
      makeChange("paddingBottom", "8px", "16px"),
      makeChange("paddingLeft", "8px", "12px"),
    ];
    const result = collapseShorthands(changes);
    expect(result).toHaveLength(4);
  });

  it("does not collapse when not all longhands present", () => {
    const changes = [
      makeChange("paddingTop", "8px", "16px"),
      makeChange("paddingBottom", "8px", "16px"),
    ];
    const result = collapseShorthands(changes);
    expect(result).toHaveLength(2);
  });

  it("collapses borderRadius longhands", () => {
    const changes = [
      makeChange("borderTopLeftRadius", "0px", "8px"),
      makeChange("borderTopRightRadius", "0px", "8px"),
      makeChange("borderBottomLeftRadius", "0px", "8px"),
      makeChange("borderBottomRightRadius", "0px", "8px"),
    ];
    const result = collapseShorthands(changes);
    expect(result).toHaveLength(1);
    expect(result[0].property).toBe("borderRadius");
  });

  it("collapses margin longhands", () => {
    const changes = [
      makeChange("marginTop", "0px", "8px"),
      makeChange("marginRight", "0px", "8px"),
      makeChange("marginBottom", "0px", "8px"),
      makeChange("marginLeft", "0px", "8px"),
    ];
    const result = collapseShorthands(changes);
    expect(result).toHaveLength(1);
    expect(result[0].property).toBe("margin");
  });

  it("preserves non-shorthand changes", () => {
    const changes = [
      makeChange("fontSize", "14px", "16px"),
      makeChange("color", "#000", "#333"),
    ];
    const result = collapseShorthands(changes);
    expect(result).toHaveLength(2);
    expect(result[0].property).toBe("fontSize");
    expect(result[1].property).toBe("color");
  });

  it("collapses some groups while preserving others", () => {
    const changes = [
      makeChange("paddingTop", "8px", "16px"),
      makeChange("paddingRight", "8px", "16px"),
      makeChange("paddingBottom", "8px", "16px"),
      makeChange("paddingLeft", "8px", "16px"),
      makeChange("fontSize", "14px", "16px"),
    ];
    const result = collapseShorthands(changes);
    expect(result).toHaveLength(2);
    expect(result.find((c) => c.property === "padding")).toBeTruthy();
    expect(result.find((c) => c.property === "fontSize")).toBeTruthy();
  });

  it("does not collapse when from values differ", () => {
    const changes = [
      makeChange("paddingTop", "8px", "16px"),
      makeChange("paddingRight", "4px", "16px"),
      makeChange("paddingBottom", "8px", "16px"),
      makeChange("paddingLeft", "4px", "16px"),
    ];
    const result = collapseShorthands(changes);
    expect(result).toHaveLength(4);
  });
});

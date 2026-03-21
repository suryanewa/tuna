import { describe, it, expect } from "vitest";
import { collapseShorthands, parsePseudoState, describeSelectorScope } from "../engine/output";
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

describe("parsePseudoState", () => {
  it("extracts :hover pseudo-state", () => {
    const result = parsePseudoState(".btn:hover");
    expect(result.base).toBe(".btn");
    expect(result.pseudoState).toBe("hover");
  });

  it("extracts :focus pseudo-state", () => {
    const result = parsePseudoState(".input:focus");
    expect(result.base).toBe(".input");
    expect(result.pseudoState).toBe("focus");
  });

  it("extracts :active pseudo-state", () => {
    const result = parsePseudoState(".btn:active");
    expect(result.base).toBe(".btn");
    expect(result.pseudoState).toBe("active");
  });

  it("extracts :focus-visible pseudo-state", () => {
    const result = parsePseudoState(".link:focus-visible");
    expect(result.base).toBe(".link");
    expect(result.pseudoState).toBe("focus-visible");
  });

  it("extracts :focus-within pseudo-state", () => {
    const result = parsePseudoState(".form-group:focus-within");
    expect(result.base).toBe(".form-group");
    expect(result.pseudoState).toBe("focus-within");
  });

  it("returns null pseudoState for plain selectors", () => {
    const result = parsePseudoState(".btn-primary");
    expect(result.base).toBe(".btn-primary");
    expect(result.pseudoState).toBeNull();
  });

  it("returns null pseudoState for path selectors", () => {
    const result = parsePseudoState("main > section > .btn");
    expect(result.base).toBe("main > section > .btn");
    expect(result.pseudoState).toBeNull();
  });

  it("handles complex selectors with pseudo-state at end", () => {
    const result = parsePseudoState(".card .btn:hover");
    expect(result.base).toBe(".card .btn");
    expect(result.pseudoState).toBe("hover");
  });

  it("does not extract pseudo-elements like ::before", () => {
    const result = parsePseudoState(".btn::before");
    expect(result.base).toBe(".btn::before");
    expect(result.pseudoState).toBeNull();
  });

  it("handles compound selector with pseudo-state", () => {
    const result = parsePseudoState(".btn.btn-primary:hover");
    expect(result.base).toBe(".btn.btn-primary");
    expect(result.pseudoState).toBe("hover");
  });
});

describe("describeSelectorScope", () => {
  it("returns class-scoped for single class selector", () => {
    const result = describeSelectorScope(".btn");
    expect(result).toMatch(/class-scoped/);
  });

  it("returns class-scoped for compound class selector", () => {
    const result = describeSelectorScope(".btn.btn-primary");
    expect(result).toMatch(/class-scoped/);
  });

  it("returns id-scoped for id selector", () => {
    const result = describeSelectorScope("#main");
    expect(result).toBe("id-scoped, unique");
  });

  it("returns element-specific for path selector with >", () => {
    const result = describeSelectorScope("main > section > .btn");
    expect(result).toBe("element-specific");
  });

  it("handles compound selector with pseudo-state", () => {
    const result = describeSelectorScope(".btn.btn-primary:hover");
    expect(result).toMatch(/class-scoped/);
  });

  it("returns null for plain tag selector", () => {
    const result = describeSelectorScope("button");
    expect(result).toBeNull();
  });
});


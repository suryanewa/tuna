import { describe, it, expect } from "vitest";
import { parseShadow, parseBoxShadow, shadowToCss, defaultShadow } from "../ui/shadow-utils";

describe("parseShadow", () => {
  it("returns null for none/empty", () => {
    expect(parseShadow("none")).toBeNull();
    expect(parseShadow("")).toBeNull();
  });

  it("parses computed rgba shadow", () => {
    const result = parseShadow("rgba(0, 0, 0, 0.15) 0px 4px 8px 0px");
    expect(result).toEqual({
      inset: false,
      offsetX: 0,
      offsetY: 4,
      blur: 8,
      spread: 0,
      color: "rgba(0, 0, 0, 0.15)",
    });
  });

  it("parses inset shadow", () => {
    const result = parseShadow("inset rgba(0, 0, 0, 0.5) 2px 3px 4px 1px");
    expect(result).not.toBeNull();
    expect(result!.inset).toBe(true);
    expect(result!.offsetX).toBe(2);
    expect(result!.offsetY).toBe(3);
    expect(result!.blur).toBe(4);
    expect(result!.spread).toBe(1);
  });

  it("parses hex color shadow", () => {
    const result = parseShadow("#000 0px 4px 8px 0px");
    expect(result).not.toBeNull();
    expect(result!.color).toBe("#000");
  });

  it("handles negative offsets", () => {
    const result = parseShadow("rgba(0, 0, 0, 0.1) -2px -3px 4px 0px");
    expect(result).not.toBeNull();
    expect(result!.offsetX).toBe(-2);
    expect(result!.offsetY).toBe(-3);
  });
});

describe("parseBoxShadow", () => {
  it("returns null for none", () => {
    expect(parseBoxShadow("none")).toBeNull();
  });

  it("parses single layer", () => {
    const result = parseBoxShadow("rgba(0, 0, 0, 0.1) 0px 2px 4px 0px");
    expect(result).not.toBeNull();
    expect(result!.blur).toBe(4);
  });

  it("parses first layer of multi-layer shadow", () => {
    const result = parseBoxShadow("rgba(0, 0, 0, 0.1) 0px 2px 4px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px");
    expect(result).not.toBeNull();
    expect(result!.blur).toBe(4); // first layer
  });
});

describe("shadowToCss", () => {
  it("serializes default shadow", () => {
    const css = shadowToCss(defaultShadow());
    expect(css).toBe("0px 4px 8px 0px rgba(0, 0, 0, 0.15)");
  });

  it("serializes inset shadow", () => {
    const css = shadowToCss({ inset: true, offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: "#000" });
    expect(css).toBe("inset 0px 2px 4px 0px #000");
  });

  it("roundtrips through parse and serialize", () => {
    const original = "rgba(0, 0, 0, 0.15) 0px 4px 8px 0px";
    const parsed = parseShadow(original)!;
    const serialized = shadowToCss(parsed);
    const reparsed = parseShadow(serialized)!;
    expect(reparsed.offsetX).toBe(parsed.offsetX);
    expect(reparsed.offsetY).toBe(parsed.offsetY);
    expect(reparsed.blur).toBe(parsed.blur);
    expect(reparsed.spread).toBe(parsed.spread);
  });
});

describe("defaultShadow", () => {
  it("returns expected defaults", () => {
    const s = defaultShadow();
    expect(s.inset).toBe(false);
    expect(s.offsetY).toBe(4);
    expect(s.blur).toBe(8);
  });
});

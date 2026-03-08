import { describe, it, expect } from "vitest";
import {
  defaultGradient,
  gradientToCss,
  gradientBarCss,
  parseCssGradient,
  interpolateColor,
  detectFillMode,
} from "../ui/gradient-utils";

describe("defaultGradient", () => {
  it("returns a linear gradient with 2 stops", () => {
    const g = defaultGradient();
    expect(g.type).toBe("linear");
    expect(g.angle).toBe(180);
    expect(g.stops).toHaveLength(2);
    expect(g.stops[0].color).toBe("#ffffff");
    expect(g.stops[1].color).toBe("#000000");
  });
});

describe("gradientToCss", () => {
  it("returns none for < 2 stops", () => {
    expect(gradientToCss({ type: "linear", angle: 0, stops: [{ color: "#fff", position: 0 }] })).toBe("none");
  });

  it("generates linear gradient CSS", () => {
    const css = gradientToCss(defaultGradient());
    expect(css).toBe("linear-gradient(180deg, #ffffff 0%, #000000 100%)");
  });

  it("generates radial gradient CSS", () => {
    const css = gradientToCss({
      type: "radial",
      angle: 0,
      stops: [
        { color: "#ff0000", position: 0, opacity: 100 },
        { color: "#0000ff", position: 1, opacity: 100 },
      ],
    });
    expect(css).toMatch(/^radial-gradient\(circle,/);
  });

  it("generates conic gradient CSS", () => {
    const css = gradientToCss({
      type: "conic",
      angle: 45,
      stops: [
        { color: "#ff0000", position: 0, opacity: 100 },
        { color: "#0000ff", position: 1, opacity: 100 },
      ],
    });
    expect(css).toMatch(/^conic-gradient\(from 45deg,/);
  });

  it("sorts stops by position", () => {
    const css = gradientToCss({
      type: "linear",
      angle: 90,
      stops: [
        { color: "#0000ff", position: 1, opacity: 100 },
        { color: "#ff0000", position: 0, opacity: 100 },
      ],
    });
    expect(css).toBe("linear-gradient(90deg, #ff0000 0%, #0000ff 100%)");
  });
});

describe("gradientBarCss", () => {
  it("generates left-to-right linear gradient", () => {
    const css = gradientBarCss([
      { color: "#fff", position: 0, opacity: 100 },
      { color: "#000", position: 1, opacity: 100 },
    ]);
    expect(css).toMatch(/^linear-gradient\(to right,/);
  });
});

describe("parseCssGradient", () => {
  it("returns null for none", () => {
    expect(parseCssGradient("none")).toBeNull();
    expect(parseCssGradient("")).toBeNull();
  });

  it("parses linear gradient with angle", () => {
    const result = parseCssGradient("linear-gradient(180deg, #ffffff 0%, #000000 100%)");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("linear");
    expect(result!.angle).toBe(180);
    expect(result!.stops).toHaveLength(2);
  });

  it("parses radial gradient", () => {
    const result = parseCssGradient("radial-gradient(circle, #ff0000 0%, #0000ff 100%)");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("radial");
  });

  it("parses conic gradient", () => {
    const result = parseCssGradient("conic-gradient(from 45deg, #ff0000 0%, #0000ff 100%)");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("conic");
    expect(result!.angle).toBe(45);
  });

  it("returns null for non-gradient strings", () => {
    expect(parseCssGradient("red")).toBeNull();
    expect(parseCssGradient("#ff0000")).toBeNull();
  });

  it("roundtrips through serialize and parse", () => {
    const original = defaultGradient();
    const css = gradientToCss(original);
    const parsed = parseCssGradient(css);
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe(original.type);
    expect(parsed!.angle).toBe(original.angle);
    expect(parsed!.stops).toHaveLength(original.stops.length);
  });
});

describe("interpolateColor", () => {
  it("returns first color at position 0", () => {
    const stops = [
      { color: "#000000", position: 0 },
      { color: "#ffffff", position: 1 },
    ];
    expect(interpolateColor(stops, 0)).toBe("#000000");
  });

  it("returns last color at position 1", () => {
    const stops = [
      { color: "#000000", position: 0 },
      { color: "#ffffff", position: 1 },
    ];
    expect(interpolateColor(stops, 1)).toBe("#ffffff");
  });

  it("interpolates midpoint", () => {
    const stops = [
      { color: "#000000", position: 0 },
      { color: "#ffffff", position: 1 },
    ];
    const mid = interpolateColor(stops, 0.5);
    // Should be roughly #808080
    expect(mid).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("detectFillMode", () => {
  it("returns solid for no background image", () => {
    expect(detectFillMode("#fff", "none")).toBe("solid");
    expect(detectFillMode("#fff", undefined)).toBe("solid");
  });

  it("returns linear for linear gradient", () => {
    expect(detectFillMode(undefined, "linear-gradient(180deg, #fff 0%, #000 100%)")).toBe("linear");
  });

  it("returns radial for radial gradient", () => {
    expect(detectFillMode(undefined, "radial-gradient(circle, #fff 0%, #000 100%)")).toBe("radial");
  });
});

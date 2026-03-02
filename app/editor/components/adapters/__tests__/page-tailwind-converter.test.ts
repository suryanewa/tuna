import { describe, it, expect } from "vitest";
import {
  pageStylesToTailwind,
  applyTailwindToPageStyles,
} from "../page-tailwind-converter";
import {
  readFills,
  writeFills,
  readBorder,
  writeBorder,
  readShadow,
  writeShadow,
  readDirection,
  writeDirection,
  readAlignment,
  writeAlignment,
  readSize,
} from "../tailwind-adapters";
import { defaultPageStyles, type PageStyles } from "@/lib/playground/store";
import type { TailwindStyles } from "@/lib/playground/editor-types";

// Helper: create a full PageStyles object with overrides
function makePageStyles(overrides: Partial<PageStyles> = {}): PageStyles {
  return { ...defaultPageStyles, ...overrides };
}

describe("Forward conversion (pageStylesToTailwind)", () => {
  it("converts default page styles", () => {
    const tw = pageStylesToTailwind(makePageStyles());
    expect(tw.display).toBe("flex");
    expect(tw.flexDirection).toBe("flex-col");
    expect(tw.backgroundColor).toBeUndefined();
  });

  it("converts background color", () => {
    const tw = pageStylesToTailwind(makePageStyles({ backgroundColor: "#ff0000" }));
    expect(tw.backgroundColor).toBe("bg-[#ff0000]");
  });

  it("converts background color with opacity", () => {
    const tw = pageStylesToTailwind(
      makePageStyles({ backgroundColor: "#ff0000", backgroundOpacity: 50 })
    );
    expect(tw.backgroundColor).toBe("bg-[#ff0000]/50");
  });

  it("converts text color", () => {
    const tw = pageStylesToTailwind(makePageStyles({ textColor: "#333333" }));
    expect(tw.textColor).toBe("text-[#333333]");
  });

  it("does not include fontFamily", () => {
    const tw = pageStylesToTailwind(makePageStyles({ fontFamily: "Inter" }));
    expect(tw).not.toHaveProperty("fontFamily");
  });

  it("converts line height", () => {
    const tw = pageStylesToTailwind(makePageStyles({ lineHeight: 24 }));
    expect(tw.lineHeight).toBe("leading-[24px]");
  });

  it("converts text align", () => {
    const tw = pageStylesToTailwind(makePageStyles({ textAlign: "center" }));
    expect(tw.textAlign).toBe("text-center");
  });

  it("converts content padding", () => {
    const tw = pageStylesToTailwind(makePageStyles({ contentPadding: 16 }));
    expect(tw.padding).toBe("p-[16px]");
  });

  it("converts element gap", () => {
    const tw = pageStylesToTailwind(makePageStyles({ elementGap: 20 }));
    expect(tw.gap).toBe("gap-[20px]");
  });

  it("converts stack layout mode", () => {
    const tw = pageStylesToTailwind(makePageStyles({ layoutMode: "stack" }));
    expect(tw.display).toBe("flex");
    expect(tw.flexDirection).toBe("flex-col");
  });

  it("converts centered layout mode", () => {
    const tw = pageStylesToTailwind(makePageStyles({ layoutMode: "centered" }));
    expect(tw.display).toBe("flex");
    expect(tw.flexDirection).toBe("flex-col");
    expect(tw.alignItems).toBe("items-center");
  });

  it("converts end layout mode", () => {
    const tw = pageStylesToTailwind(makePageStyles({ layoutMode: "end" }));
    expect(tw.display).toBe("flex");
    expect(tw.flexDirection).toBe("flex-col");
    expect(tw.alignItems).toBe("items-end");
  });

  it("converts grid layout mode", () => {
    const tw = pageStylesToTailwind(makePageStyles({ layoutMode: "grid" }));
    expect(tw.display).toBe("grid");
    expect(tw.flexWrap).toBe("flex-wrap");
  });

  it("converts max width", () => {
    const tw = pageStylesToTailwind(makePageStyles({ maxWidth: 800 }));
    expect(tw.maxWidth).toBe("max-w-[800px]");
    expect(tw.marginX).toBe("mx-[auto]");
  });

  it("converts border radius to named preset", () => {
    const tw = pageStylesToTailwind(makePageStyles({ borderRadius: 8 }));
    expect(tw.borderRadius).toBe("rounded-lg");
  });

  it("converts border radius to arbitrary", () => {
    const tw = pageStylesToTailwind(makePageStyles({ borderRadius: 10 }));
    expect(tw.borderRadius).toBe("rounded-[10px]");
  });

  it("converts border with opacity", () => {
    const tw = pageStylesToTailwind(
      makePageStyles({
        borderWidth: 2,
        borderColor: "#000000",
        borderOpacity: 80,
        borderStyle: "solid",
      })
    );
    expect(tw.borderWidth).toBe("border-2");
    expect(tw.borderColor).toBe("border-[#000000]/80");
    expect(tw.borderStyle).toBe("border-solid");
  });

  it("converts shadow from shadowData", () => {
    const shadowData = JSON.stringify({
      type: "outside",
      angle: 90,
      distance: 20,
      brightness: 8,
      elevation: 60,
      color: "#000000",
      opacity: 10,
    });
    const tw = pageStylesToTailwind(makePageStyles({ shadowData }));
    // writeShadow finds the closest preset by elevation+distance — shadow-md matches (distance=20, elevation=60)
    expect(tw.shadow).toBeDefined();
    expect(typeof tw.shadow).toBe("string");
    // Should be a recognized shadow preset string
    expect(tw.shadow).toMatch(/^shadow/);
  });

  it("converts gradient", () => {
    const tw = pageStylesToTailwind(
      makePageStyles({
        gradientEnabled: true,
        gradientType: "linear",
        gradientAngle: 45,
        gradientStart: "#ff0000",
        gradientEnd: "#0000ff",
      })
    );
    expect(tw.backgroundGradient).toBeDefined();
    expect(tw.gradientFrom).toBeDefined();
    expect(tw.gradientTo).toBeDefined();
  });

  it("null padding produces explicit zero padding class", () => {
    const tw = pageStylesToTailwind(makePageStyles({ contentPadding: null }));
    expect(tw.padding).toBe("p-0");
  });

  it("null gap produces no gap class", () => {
    const tw = pageStylesToTailwind(makePageStyles({ elementGap: null }));
    expect(tw.gap).toBeUndefined();
  });
});

describe("Reverse conversion (applyTailwindToPageStyles)", () => {
  it("converts background color back", () => {
    const result = applyTailwindToPageStyles(
      { backgroundColor: "bg-[#ff0000]" },
      makePageStyles()
    );
    expect(result.backgroundColor).toBe("#ff0000");
  });

  it("converts background color with opacity back", () => {
    const result = applyTailwindToPageStyles(
      { backgroundColor: "bg-[#ff0000]/50" },
      makePageStyles()
    );
    expect(result.backgroundColor).toBe("#ff0000");
    expect(result.backgroundOpacity).toBe(50);
  });

  it("converts text color back", () => {
    const result = applyTailwindToPageStyles(
      { textColor: "text-[#333333]" },
      makePageStyles()
    );
    expect(result.textColor).toBe("#333333");
  });

  it("converts padding back", () => {
    const result = applyTailwindToPageStyles(
      { padding: "p-[16px]" },
      makePageStyles()
    );
    expect(result.contentPadding).toBe(16);
  });

  it("converts gap back", () => {
    const result = applyTailwindToPageStyles(
      { gap: "gap-[20px]" },
      makePageStyles()
    );
    expect(result.elementGap).toBe(20);
  });

  it("converts max width back", () => {
    const result = applyTailwindToPageStyles(
      { maxWidth: "max-w-[800px]" },
      makePageStyles()
    );
    expect(result.maxWidth).toBe(800);
  });

  it("clears max width", () => {
    const result = applyTailwindToPageStyles(
      { maxWidth: undefined },
      makePageStyles({ maxWidth: 800 })
    );
    expect(result.maxWidth).toBeNull();
  });

  it("converts border radius back from named", () => {
    const result = applyTailwindToPageStyles(
      { borderRadius: "rounded-lg" },
      makePageStyles()
    );
    expect(result.borderRadius).toBe(8);
  });

  it("converts border radius back from arbitrary", () => {
    const result = applyTailwindToPageStyles(
      { borderRadius: "rounded-[10px]" },
      makePageStyles()
    );
    expect(result.borderRadius).toBe(10);
  });

  it("converts border back", () => {
    const result = applyTailwindToPageStyles(
      {
        borderWidth: "border-2",
        borderColor: "border-[#000000]/80",
        borderStyle: "border-solid",
      },
      makePageStyles()
    );
    expect(result.borderWidth).toBe(2);
    expect(result.borderColor).toBe("#000000");
    expect(result.borderOpacity).toBe(80);
    expect(result.borderStyle).toBe("solid");
  });

  it("converts layout direction vertical to stack", () => {
    const current = makePageStyles({ layoutMode: "grid" });
    // writeDirection("vertical") sets flexWrap: undefined, which signals to the
    // converter that grid mode should be exited even though display is still "grid"
    const directionUpdate = writeDirection("vertical");
    const result = applyTailwindToPageStyles(directionUpdate, current);
    expect(result.layoutMode).toBe("stack");
  });

  it("converts layout direction horizontal to horizontal", () => {
    const current = makePageStyles({ layoutMode: "stack" });
    const directionUpdate = writeDirection("horizontal");
    const result = applyTailwindToPageStyles(directionUpdate, current);
    expect(result.layoutMode).toBe("horizontal");
  });

  it("horizontal layout round-trips through forward conversion", () => {
    const ps = makePageStyles({ layoutMode: "horizontal" });
    const tw = pageStylesToTailwind(ps);
    expect(tw.flexDirection).toBe("flex-row");
    expect(tw.display).toBe("flex");
  });

  it("converts layout direction wrap to grid", () => {
    const current = makePageStyles({ layoutMode: "stack" });
    const directionUpdate = writeDirection("wrap");
    const result = applyTailwindToPageStyles(directionUpdate, current);
    expect(result.layoutMode).toBe("grid");
  });

  it("converts alignment center to centered", () => {
    const current = makePageStyles({ layoutMode: "stack" });
    const alignmentUpdate = writeAlignment("top-center", "vertical");
    const result = applyTailwindToPageStyles(alignmentUpdate, current);
    expect(result.layoutMode).toBe("centered");
  });

  it("converts alignment end to end", () => {
    const current = makePageStyles({ layoutMode: "stack" });
    const alignmentUpdate = writeAlignment("top-right", "vertical");
    const result = applyTailwindToPageStyles(alignmentUpdate, current);
    expect(result.layoutMode).toBe("end");
  });

  it("grid to vertical transition clears flexWrap", () => {
    const current = makePageStyles({ layoutMode: "grid" });
    const directionUpdate = writeDirection("vertical");
    // writeDirection("vertical") explicitly sets flexWrap: undefined
    expect(directionUpdate.flexWrap).toBeUndefined();
    // The converter detects that flexWrap was explicitly cleared and exits grid mode
    const result = applyTailwindToPageStyles(directionUpdate, current);
    expect(result.layoutMode).toBe("stack");
  });
});

describe("justifyContent (vertical alignment)", () => {
  it("emits justifyContent when set in PageStyles", () => {
    const tw = pageStylesToTailwind(makePageStyles({ justifyContent: "center" }));
    expect(tw.justifyContent).toBe("justify-center");
  });

  it("emits justify-end for end value", () => {
    const tw = pageStylesToTailwind(makePageStyles({ justifyContent: "end" }));
    expect(tw.justifyContent).toBe("justify-end");
  });

  it("emits justify-between for between value", () => {
    const tw = pageStylesToTailwind(makePageStyles({ justifyContent: "between" }));
    expect(tw.justifyContent).toBe("justify-between");
  });

  it("does NOT emit justifyContent when null", () => {
    const tw = pageStylesToTailwind(makePageStyles({ justifyContent: null }));
    expect(tw.justifyContent).toBeUndefined();
  });

  it("reverse-maps justify-center to center", () => {
    const result = applyTailwindToPageStyles(
      { justifyContent: "justify-center" },
      makePageStyles(),
    );
    expect(result.justifyContent).toBe("center");
  });

  it("reverse-maps justify-end to end", () => {
    const result = applyTailwindToPageStyles(
      { justifyContent: "justify-end" },
      makePageStyles(),
    );
    expect(result.justifyContent).toBe("end");
  });

  it("reverse-maps justify-between to between", () => {
    const result = applyTailwindToPageStyles(
      { justifyContent: "justify-between" },
      makePageStyles(),
    );
    expect(result.justifyContent).toBe("between");
  });

  it("clears justifyContent when set to undefined", () => {
    const result = applyTailwindToPageStyles(
      { justifyContent: undefined },
      makePageStyles({ justifyContent: "center" }),
    );
    expect(result.justifyContent).toBeNull();
  });

  it("readAlignment returns correct 9-position with justifyContent", () => {
    const tw = pageStylesToTailwind(
      makePageStyles({ layoutMode: "centered", justifyContent: "center" }),
    );
    const alignment = readAlignment(tw as TailwindStyles, "vertical");
    expect(alignment).toBe("center-center");
  });

  it("readAlignment defaults to top when justifyContent is null", () => {
    const tw = pageStylesToTailwind(
      makePageStyles({ layoutMode: "centered", justifyContent: null }),
    );
    const alignment = readAlignment(tw as TailwindStyles, "vertical");
    expect(alignment).toBe("top-center");
  });

  it("writeAlignment round-trips through page converter", () => {
    const current = makePageStyles({ layoutMode: "stack" });
    const twUpdate = writeAlignment("center-center", "vertical");
    const delta = applyTailwindToPageStyles(twUpdate, current);

    expect(delta.layoutMode).toBe("centered"); // alignItems: items-center
    expect(delta.justifyContent).toBe("center"); // justifyContent: justify-center

    const updated = makePageStyles({ ...current, ...delta });
    const tw = pageStylesToTailwind(updated);
    const readBack = readAlignment(tw as TailwindStyles, "vertical");
    expect(readBack).toBe("center-center");
  });

  it("bottom-right alignment round-trips", () => {
    const current = makePageStyles({ layoutMode: "stack" });
    const twUpdate = writeAlignment("bottom-right", "vertical");
    const delta = applyTailwindToPageStyles(twUpdate, current);

    expect(delta.layoutMode).toBe("end"); // alignItems: items-end
    expect(delta.justifyContent).toBe("end"); // justifyContent: justify-end

    const updated = makePageStyles({ ...current, ...delta });
    const tw = pageStylesToTailwind(updated);
    const readBack = readAlignment(tw as TailwindStyles, "vertical");
    expect(readBack).toBe("bottom-right");
  });
});

describe("Round-trips", () => {
  it("background color round-trips", () => {
    const original = makePageStyles({ backgroundColor: "#abcdef", backgroundOpacity: 75 });

    // Forward: PageStyles → TailwindStyles
    const tw = pageStylesToTailwind(original);

    // Read fills from the TW representation
    const fills = readFills(tw as TailwindStyles);
    expect(fills.length).toBeGreaterThanOrEqual(1);

    // Write fills back (simulating a no-op edit)
    const twUpdates = writeFills(fills);

    // Reverse: TailwindStyles updates → PageStyles delta
    const delta = applyTailwindToPageStyles(twUpdates, original);
    expect(delta.backgroundColor).toBe("#abcdef");
    expect(delta.backgroundOpacity).toBe(75);
  });

  it("border round-trips", () => {
    const original = makePageStyles({
      borderWidth: 4,
      borderColor: "#ff5500",
      borderOpacity: 60,
      borderStyle: "dashed",
    });

    // Forward
    const tw = pageStylesToTailwind(original);

    // Read border from TW
    const border = readBorder(tw as TailwindStyles);
    expect(border).not.toBeNull();
    expect(border!.width).toBe(4);
    expect(border!.color).toBe("#ff5500");
    expect(border!.opacity).toBe(60);
    expect(border!.style).toBe("dashed");

    // Write border back
    const twUpdates = writeBorder(border);

    // Reverse
    const delta = applyTailwindToPageStyles(twUpdates, original);
    expect(delta.borderWidth).toBe(4);
    expect(delta.borderColor).toBe("#ff5500");
    expect(delta.borderOpacity).toBe(60);
    expect(delta.borderStyle).toBe("dashed");
  });

  it("maxWidth add/remove round-trips (PageSizeBridge scenario)", () => {
    // Simulate adding maxWidth
    const base = makePageStyles();
    const addDelta = applyTailwindToPageStyles(
      { maxWidth: "max-w-[800px]" },
      base,
    );
    expect(addDelta.maxWidth).toBe(800);

    // After adding, TW output should include maxWidth
    const withMax = makePageStyles({ ...base, ...addDelta });
    const twWithMax = pageStylesToTailwind(withMax);
    expect(twWithMax.maxWidth).toBe("max-w-[800px]");

    // readSize should return the maxWidth string
    const sizeWithMax = readSize(twWithMax as TailwindStyles);
    expect(sizeWithMax.maxWidth).toBeDefined();

    // Simulate removing maxWidth (clicking minus button)
    const removeDelta = applyTailwindToPageStyles(
      { maxWidth: undefined },
      withMax,
    );
    expect(removeDelta.maxWidth).toBeNull();

    // After removing, TW output should NOT include maxWidth
    const withoutMax = makePageStyles({ ...withMax, ...removeDelta });
    const twWithout = pageStylesToTailwind(withoutMax);
    expect(twWithout.maxWidth).toBeUndefined();

    // readSize should return undefined — used by PageSizeBridge to decide showMaxSize
    const sizeWithout = readSize(twWithout as TailwindStyles);
    expect(sizeWithout.maxWidth).toBeUndefined();
  });

  it("shadow round-trips through writeShadow", () => {
    const shadowValue = {
      type: "outside" as const,
      angle: 90,
      distance: 20,
      brightness: 8,
      elevation: 60,
      color: "#000000",
      opacity: 10,
    };

    // Write shadow to TW classes
    const twUpdates = writeShadow(shadowValue);
    expect(twUpdates.shadow).toBeDefined();

    // Apply to a base page styles
    const base = makePageStyles();
    const delta = applyTailwindToPageStyles(twUpdates, base);
    expect(delta.shadowData).toBeDefined();

    // Parse the stored shadowData and convert back to TW
    const roundTripped = makePageStyles({ ...base, ...delta });
    const tw2 = pageStylesToTailwind(roundTripped);

    // Read back the shadow
    const readBack = readShadow(tw2 as TailwindStyles);
    expect(readBack).not.toBeNull();
    // The shadow type should be preserved
    expect(readBack!.type).toBe("outside");
    // Color and opacity should be consistent
    expect(readBack!.color).toBe("#000000");
    expect(readBack!.opacity).toBe(10);
  });
});

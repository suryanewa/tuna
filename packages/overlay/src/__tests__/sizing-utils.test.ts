import { describe, it, expect } from "vitest";
import { computeSizingChanges, type SizingContext } from "../ui/sizing-utils";

function makeCtx(overrides: Partial<SizingContext> = {}): SizingContext {
  return {
    isFlexChild: false,
    isGridChild: false,
    parentFlexDir: "row",
    currentStyles: {},
    elementRect: { width: 200, height: 100 },
    ...overrides,
  };
}

describe("computeSizingChanges — block element", () => {
  it("fill sets width to 100%", () => {
    const changes = computeSizingChanges("width", "fill", makeCtx());
    expect(changes.width).toBe("100%");
  });

  it("hug sets width to fit-content", () => {
    const changes = computeSizingChanges("width", "hug", makeCtx());
    expect(changes.width).toBe("fit-content");
  });

  it("fixed sets width to px value from rect", () => {
    const changes = computeSizingChanges("width", "fixed", makeCtx());
    expect(changes.width).toBe("200px");
  });

  it("fixed height uses rect height", () => {
    const changes = computeSizingChanges("height", "fixed", makeCtx());
    expect(changes.height).toBe("100px");
  });

  it("fixed defaults to 200px without rect", () => {
    const changes = computeSizingChanges("width", "fixed", makeCtx({ elementRect: undefined }));
    expect(changes.width).toBe("200px");
  });
});

describe("computeSizingChanges — grid child", () => {
  const gridCtx = () => makeCtx({ isGridChild: true });

  it("fill sets auto + stretch", () => {
    const changes = computeSizingChanges("width", "fill", gridCtx());
    expect(changes.width).toBe("auto");
    expect(changes.justifySelf).toBe("stretch");
  });

  it("hug sets fit-content and resets justifySelf from stretch", () => {
    const changes = computeSizingChanges("width", "hug", makeCtx({
      isGridChild: true,
      currentStyles: { justifySelf: "stretch" },
    }));
    expect(changes.width).toBe("fit-content");
    expect(changes.justifySelf).toBe("start");
  });

  it("hug does not reset justifySelf if already set", () => {
    const changes = computeSizingChanges("width", "hug", makeCtx({
      isGridChild: true,
      currentStyles: { justifySelf: "center" },
    }));
    expect(changes.width).toBe("fit-content");
    expect(changes.justifySelf).toBeUndefined();
  });

  it("fill height sets alignSelf stretch", () => {
    const changes = computeSizingChanges("height", "fill", gridCtx());
    expect(changes.height).toBe("auto");
    expect(changes.alignSelf).toBe("stretch");
  });
});

describe("computeSizingChanges — flex main axis", () => {
  const flexRowCtx = (styles: Record<string, string> = {}) =>
    makeCtx({ isFlexChild: true, parentFlexDir: "row", currentStyles: styles });

  it("fill sets flex grow/shrink/basis", () => {
    const changes = computeSizingChanges("width", "fill", flexRowCtx());
    expect(changes.flexGrow).toBe("1");
    expect(changes.flexShrink).toBe("1");
    expect(changes.flexBasis).toBe("0px");
    expect(changes.width).toBe("auto");
  });

  it("hug resets flex grow/shrink", () => {
    const changes = computeSizingChanges("width", "hug", flexRowCtx());
    expect(changes.flexGrow).toBe("0");
    expect(changes.flexShrink).toBe("0");
    expect(changes.flexBasis).toBe("auto");
    expect(changes.width).toBe("auto");
  });

  it("fixed sets px when current is auto", () => {
    const changes = computeSizingChanges("width", "fixed", flexRowCtx({ width: "auto" }));
    expect(changes.width).toBe("200px");
    expect(changes.flexGrow).toBe("0");
  });

  it("column flex uses height as main axis", () => {
    const ctx = makeCtx({ isFlexChild: true, parentFlexDir: "column" });
    const changes = computeSizingChanges("height", "fill", ctx);
    expect(changes.flexGrow).toBe("1");
    expect(changes.height).toBe("auto");
  });
});

describe("computeSizingChanges — flex cross axis", () => {
  const flexRowCtx = (styles: Record<string, string> = {}) =>
    makeCtx({ isFlexChild: true, parentFlexDir: "row", currentStyles: styles });

  it("fill sets 100% + stretch", () => {
    const changes = computeSizingChanges("height", "fill", flexRowCtx());
    expect(changes.height).toBe("100%");
    expect(changes.alignSelf).toBe("stretch");
  });

  it("hug sets auto + flex-start when alignSelf is stretch", () => {
    const changes = computeSizingChanges("height", "hug", flexRowCtx({ alignSelf: "stretch" }));
    expect(changes.height).toBe("auto");
    expect(changes.alignSelf).toBe("flex-start");
  });

  it("hug preserves non-stretch alignSelf", () => {
    const changes = computeSizingChanges("height", "hug", flexRowCtx({ alignSelf: "center" }));
    expect(changes.height).toBe("auto");
    expect(changes.alignSelf).toBeUndefined();
  });
});

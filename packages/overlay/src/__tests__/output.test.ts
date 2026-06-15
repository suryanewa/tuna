import { describe, it, expect, beforeAll } from "vitest";
import {
  collapseShorthands,
  parsePseudoState,
  describeSelectorScope,
  formatElementInfo,
  formatDrawingAnnotations,
  formatSelectionPrompt,
} from "../engine/output";
import type { PropertyChange, InspectedElement } from "../types";
import type { CommentElementTarget } from "../engine/comment-store";
import type { VisualSnapshot } from "../engine/output";

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

  it("returns ancestor-scoped for descendant class selector", () => {
    const result = describeSelectorScope(".message-row--unread .message-row__subject");
    expect(result).toMatch(/ancestor-scoped/);
  });

  it("returns ancestor-scoped for child combinator class selector", () => {
    const result = describeSelectorScope(".card > .card__title");
    expect(result).toMatch(/ancestor-scoped/);
  });

  it("returns ancestor-scoped for :where() with descendant", () => {
    const result = describeSelectorScope(':where([data-theme="dark"]) .card');
    expect(result).toMatch(/ancestor-scoped/);
  });

  it("returns ancestor-scoped for attribute selector ancestor", () => {
    const result = describeSelectorScope('[data-state="open"] .content');
    expect(result).toMatch(/ancestor-scoped/);
  });

  it("returns class-scoped (not ancestor) for compound without combinator", () => {
    const result = describeSelectorScope(".btn.btn-primary");
    expect(result).toMatch(/class-scoped/);
    expect(result).not.toMatch(/ancestor/);
  });
});

function makeInspectedElement(overrides: Partial<InspectedElement> = {}): InspectedElement {
  const element = {
    textContent: "Get Started",
  } as Element;
  return {
    element,
    selector: "main > section.hero > button.btn-primary",
    tagName: "BUTTON",
    textContent: "Get Started",
    classes: ["btn", "btn-primary"],
    rect: { x: 340, y: 520, width: 120, height: 40 } as DOMRect,
    computedStyles: {},
    layoutMode: "block",
    reactComponents: ["HeroSection", "Button"],
    reactProps: null,
    reactState: null,
    sourceFile: { fileName: "src/components/HeroSection.tsx", lineNumber: 42, columnNumber: 10 },
    stylingApproach: "tailwind",
    inlineStyles: null,
    elementId: null,
    accessibleName: null,
    parentContext: "div.hero__actions",
    childSummary: null,
    domPath: "body > main > section.hero > div > button.btn-primary",
    nearbySiblings: "span, **button**, a",
    position: { x: 340, y: 520, width: 120, height: 40 },
    ...overrides,
  };
}

describe("formatElementInfo", () => {
  beforeAll(() => {
    (globalThis as any).window = {
      location: { href: "http://localhost:3000/" },
      innerWidth: 1280,
      innerHeight: 800,
      scrollX: 0,
      scrollY: 240,
    };
  });

  it("includes core identification fields", () => {
    const output = formatElementInfo(makeInspectedElement());
    expect(output).toContain("Selected element from Tuna:");
    expect(output).toContain('Element: <button> "Get Started"');
    expect(output).toContain("Component: HeroSection → Button");
    expect(output).toContain("Source: `src/components/HeroSection.tsx:42:10`");
    expect(output).toContain("Selector: `main > section.hero > button.btn-primary`");
    expect(output).toContain("Classes: `btn btn-primary`");
    expect(output).toContain("Dimensions: 120×40px at (340, 520)");
    expect(output).toContain("Layout: block");
    expect(output).toContain("Styling: Tailwind CSS");
    expect(output).toContain("DOM Path:");
    expect(output).toContain("Parent: `div.hero__actions`");
    expect(output).toContain("Nearby elements:");
  });

  it("uses selector override when provided", () => {
    const output = formatElementInfo(makeInspectedElement(), { selector: ".btn-primary" });
    expect(output).toContain("Selector: `.btn-primary`");
  });

  it("adds file hint when source file is unavailable", () => {
    const output = formatElementInfo(makeInspectedElement({ sourceFile: null }));
    expect(output).toContain("File hint: search for `Button` component with text \"Get Started\"");
    expect(output).not.toContain("Source:");
  });
});

function makeDrawingTarget(overrides: Partial<CommentElementTarget> = {}): CommentElementTarget {
  return {
    tagName: "drawing",
    selector: "tuna-drawing:1",
    componentName: "Drawing 1",
    componentPath: [],
    classes: [],
    textContent: null,
    mentionColor: "#0D99FF",
    drawing: {
      orderIndex: 1,
      pathData: "M 10 10 L 120 10 L 120 80 Z",
      stroke: "#0D99FF",
      fill: "rgba(13, 153, 255, 0.12)",
      bounds: { x: 10, y: 10, width: 110, height: 70 },
      pageBounds: { x: 10, y: 250, width: 110, height: 70 },
    },
    ...overrides,
  };
}

function makeVisualSnapshot(): VisualSnapshot {
  return {
    kind: "dom-spatial-snapshot",
    capturedAt: "2026-06-15T00:00:00.000Z",
    viewport: { width: 1440, height: 900 },
    scroll: { x: 0, y: 240 },
    selectedSelectors: [".hero .btn-primary"],
    drawingSelectors: ["tuna-drawing:1"],
    elements: [
      {
        tagName: "button",
        selector: ".btn-primary",
        componentName: "Button",
        textContent: "Get Started",
        classes: ["btn", "btn-primary"],
        bounds: { x: 340, y: 520, width: 120, height: 40 },
        zIndex: "10",
      },
    ],
  };
}

describe("visual prompt formatting", () => {
  beforeAll(() => {
    (globalThis as any).window = {
      location: { href: "http://localhost:3000/dashboard" },
      innerWidth: 1440,
      innerHeight: 900,
      scrollX: 0,
      scrollY: 240,
    };
  });

  it("formats drawing annotations with geometry and contained elements", () => {
    const output = formatDrawingAnnotations([{
      target: makeDrawingTarget(),
      containedElements: [
        { tagName: "button", selector: ".save", componentName: "SaveButton", textContent: "Save" },
      ],
    }], { visualSnapshot: makeVisualSnapshot() });

    expect(output).toContain("Drawn annotations from Tuna:");
    expect(output).toContain("Viewport: 1440×900");
    expect(output).toContain("Page-state snapshot:");
    expect(output).toContain("Selected selectors: `.hero .btn-primary`");
    expect(output).toContain("Visible context:");
    expect(output).toContain("`Drawing 1`");
    expect(output).toContain("selector `tuna-drawing:1`");
    expect(output).toContain("viewport bounds (10, 10) 110×70px");
    expect(output).toContain("page bounds (10, 250) 110×70px");
    expect(output).toContain("path `M 10 10 L 120 10 L 120 80 Z`");
    expect(output).toContain("`<button>` `.save` \"Save\" (SaveButton)");
  });

  it("formats a mixed element and drawing selection for copy/MCP", () => {
    const output = formatSelectionPrompt([makeInspectedElement()], {
      primary: makeInspectedElement(),
      activeSelector: ".hero .btn-primary",
      drawings: [{ target: makeDrawingTarget() }],
      visualSnapshot: makeVisualSnapshot(),
    });

    expect(output).toContain("selected element");
    expect(output).toContain("drawing annotation");
    expect(output).toContain("Page-state snapshot:");
    expect(output).toContain("`<button>` `.btn-primary`");
    expect(output).toContain("## Element 1");
    expect(output).toContain('Element: <button> "Get Started"');
    expect(output).toContain("## Drawing Annotations");
    expect(output).toContain("tuna-drawing:1");
  });
});

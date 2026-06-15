import { describe, expect, it } from "vitest";
import {
  buildDrawingCommentTarget,
  buildDrawingTargetsFromPaths,
  resolveActiveDrawPaths,
  getDrawingMentionName,
  getDrawingOrderIndex,
  getMentionName,
  getMentionNameForTarget,
  orderTargetsBySelectors,
  parseCommentTextIntoParts,
  areDraftElementTargetsEqual,
  applyTargetsToDraft,
  getCommentElementTargets,
  getDraftElementTargets,
  syncElementTargetsInDraft,
  syncDrawingTargetsInDraft,
} from "../overlay/comment/comment-draft";
import type { InspectedElement } from "../types";

function mockDrawPath(
  stroke: string,
  drawColor?: string,
  rect: Partial<DOMRect> = {},
): SVGPathElement {
  return {
    getAttribute(name: string) {
      if (name === "stroke") return stroke;
      if (name === "data-tuna-draw-color") return drawColor ?? null;
      if (name === "d") return "M 10 20 L 40 60 Z";
      if (name === "fill") return "none";
      return null;
    },
    getBoundingClientRect() {
      return {
        left: rect.left ?? 10,
        top: rect.top ?? 20,
        width: rect.width ?? 30,
        height: rect.height ?? 40,
      } as DOMRect;
    },
  } as SVGPathElement;
}

const targets = [
  {
    tagName: "button",
    selector: ".btn",
    componentName: "Button",
    classes: [],
    textContent: "Click",
  },
  {
    tagName: "span",
    selector: ".label",
    componentName: "Label",
    classes: [],
    textContent: "Beta",
  },
];

function inspectedElement(
  selector: string,
  tagName: string,
  reactComponents: string[] = [],
): InspectedElement {
  return {
    element: {} as Element,
    selector,
    tagName,
    textContent: tagName === "button" ? "Save" : "Label",
    classes: [selector.slice(1)],
    rect: {} as DOMRect,
    computedStyles: {},
    layoutMode: "block",
    reactComponents,
    reactProps: null,
    reactState: null,
    sourceFile: { fileName: "Component.tsx", lineNumber: 12 },
    stylingApproach: "css",
    inlineStyles: null,
    elementId: null,
    accessibleName: null,
    parentContext: null,
    childSummary: null,
    domPath: `body > ${tagName}`,
    nearbySiblings: null,
    position: { x: 0, y: 0, width: 10, height: 10 },
  };
}

describe("parseCommentTextIntoParts", () => {
  it("reconstructs leading mentions and user text", () => {
    const parts = parseCommentTextIntoParts("@Button @Label align these", targets);
    expect(parts).toEqual([
      { type: "mention", mention: { name: "Button", color: "#0D99FF", selector: ".btn" } },
      { type: "text", text: " " },
      { type: "mention", mention: { name: "Label", color: "#FF6B6B", selector: ".label" } },
      { type: "text", text: " align these" },
    ]);
  });

  it("reconstructs inline mentions", () => {
    const parts = parseCommentTextIntoParts("Fix @Button and @Label spacing", targets);
    expect(parts).toEqual([
      { type: "text", text: "Fix " },
      { type: "mention", mention: { name: "Button", color: "#0D99FF", selector: ".btn" } },
      { type: "text", text: " and " },
      { type: "mention", mention: { name: "Label", color: "#FF6B6B", selector: ".label" } },
      { type: "text", text: " spacing" },
    ]);
  });

  it("returns plain text when no targets are available", () => {
    expect(parseCommentTextIntoParts("@Button hello", [])).toEqual([
      { type: "text", text: "@Button hello" },
    ]);
  });

  it("uses stored mentionColor for drawing targets when re-opening a comment", () => {
    const drawingTargets = [
      buildDrawingCommentTarget(1, "#845EF7"),
      buildDrawingCommentTarget(2, "#20C997"),
    ];
    const parts = parseCommentTextIntoParts("@Drawing 1 @Drawing 2 overlap", drawingTargets);
    expect(parts).toEqual([
      { type: "mention", mention: { name: "Drawing 1", color: "#845EF7", selector: "tuna-drawing:1" } },
      { type: "text", text: " " },
      { type: "mention", mention: { name: "Drawing 2", color: "#20C997", selector: "tuna-drawing:2" } },
      { type: "text", text: " overlap" },
    ]);
  });
});

describe("drawing mention names", () => {
  it("names drawings by creation order", () => {
    const paths = [mockDrawPath("#0D99FF"), mockDrawPath("#FF6B6B"), mockDrawPath("#51CF66")];
    expect(getDrawingOrderIndex(paths[1], paths)).toBe(2);
    expect(getDrawingMentionName(2)).toBe("Drawing 2");
    expect(buildDrawingCommentTarget(2, "#FF6B6B")).toEqual({
      tagName: "drawing",
      selector: "tuna-drawing:2",
      componentName: "Drawing 2",
      componentPath: [],
      classes: [],
      textContent: null,
      mentionColor: "#FF6B6B",
    });
    expect(getMentionName("drawing", "Drawing 2")).toBe("Drawing 2");
  });

  it("captures each drawing outline stroke as mentionColor", () => {
    const paths = [
      mockDrawPath("#0D99FF"),
      mockDrawPath("#FF6B6B"),
      mockDrawPath("#845EF7"),
    ];
    const drawingTargets = buildDrawingTargetsFromPaths([paths[0], paths[2]], paths);
    expect(drawingTargets.map((target) => ({
      selector: target.selector,
      mentionColor: target.mentionColor,
      componentName: target.componentName,
    }))).toEqual([
      { selector: "tuna-drawing:1", mentionColor: "#0D99FF", componentName: "Drawing 1" },
      { selector: "tuna-drawing:3", mentionColor: "#845EF7", componentName: "Drawing 3" },
    ]);
    expect(drawingTargets.every((target) => target.drawing?.pathData)).toBe(true);
  });

  it("syncs multi-selected drawings into an open draft", () => {
    const paths = [
      mockDrawPath("#0D99FF"),
      mockDrawPath("#FF6B6B"),
      mockDrawPath("#51CF66"),
    ];
    const synced = syncDrawingTargetsInDraft(
      {
        position: { x: 0, y: 0 },
        type: "element",
        spanMentionCount: 1,
        elementInfo: {
          tagName: "button",
          componentName: "Button",
          componentPath: [],
          classes: [],
          textContent: "Save",
          selectedElements: [{
            tagName: "button",
            selector: ".btn",
            componentName: "Button",
            classes: [],
            textContent: "Save",
          }],
        },
      },
      [paths[0], paths[2]],
      paths,
    );

    expect(buildDrawingTargetsFromPaths([paths[0], paths[2]], paths).map((target) => target.selector)).toEqual([
      "tuna-drawing:1",
      "tuna-drawing:3",
    ]);
    expect(synced.spanMentionCount).toBe(3);
    expect(synced.elementInfo?.selectedElements?.map((target) => target.selector)).toEqual([
      ".btn",
      "tuna-drawing:1",
      "tuna-drawing:3",
    ]);
    expect(synced.elementInfo?.selectedElements?.map((target) => target.mentionColor)).toEqual([
      undefined,
      "#0D99FF",
      "#51CF66",
    ]);
    expect(areDraftElementTargetsEqual(
      [{ tagName: "button", selector: ".btn", componentName: "Button", componentPath: [], classes: [], textContent: "Save" }],
      [{ tagName: "button", selector: ".btn", componentName: "Button", componentPath: [], classes: [], textContent: "Save" }],
    )).toBe(true);
  });
});

describe("element mention names", () => {
  it("uses element-specific text when selected targets share the same component name", () => {
    const duplicateComponentTargets = [
      {
        tagName: "button",
        selector: ".cta-primary",
        componentName: "InnerScrollAndFocusHandlerOld",
        classes: ["cta-primary"],
        textContent: "Try it here",
      },
      {
        tagName: "p",
        selector: ".hero-sub",
        componentName: "InnerScrollAndFocusHandlerOld",
        classes: ["hero-sub"],
        textContent: "Tuna lets you select and tweak any element right in the browser.",
      },
      {
        tagName: "h1",
        selector: ".hero-heading",
        componentName: "InnerScrollAndFocusHandlerOld",
        classes: ["hero-heading"],
        textContent: "The visual layer for vibe coding.",
      },
    ];

    expect(duplicateComponentTargets.map((target) =>
      getMentionNameForTarget(target, duplicateComponentTargets),
    )).toEqual([
      "Try it here",
      "Tuna lets you select and tweak any element ri...",
      "The visual layer for vibe coding.",
    ]);
  });

  it("keeps a unique component name when it distinguishes the target", () => {
    const selectedTargets = [
      { tagName: "button", selector: ".btn", componentName: "Button", classes: [], textContent: "Save" },
      { tagName: "span", selector: ".label", componentName: "Label", classes: [], textContent: "Beta" },
    ];

    expect(selectedTargets.map((target) => getMentionNameForTarget(target, selectedTargets))).toEqual([
      "Button",
      "Label",
    ]);
  });

  it("does not expose wrapper component names for a single target", () => {
    expect(getMentionNameForTarget({
      tagName: "h1",
      selector: ".hero-heading",
      componentName: "InnerScrollAndFocusHandlerOld",
      componentPath: ["InnerScrollAndFocusHandlerOld"],
      classes: ["hero-heading"],
      textContent: "The visual layer for vibe coding.",
    })).toBe("The visual layer for vibe coding.");
  });

  it("uses a meaningful component from the path before falling back to text", () => {
    expect(getMentionNameForTarget({
      tagName: "button",
      selector: ".cta-primary",
      componentName: "InnerScrollAndFocusHandlerOld",
      componentPath: ["TryItButton", "InnerScrollAndFocusHandlerOld"],
      classes: ["cta-primary"],
      textContent: "Try it here",
    })).toBe("TryItButton");
  });
});

describe("orderTargetsBySelectors", () => {
  it("keeps only selectors from the snapshot in document order", () => {
    const ordered = orderTargetsBySelectors(targets, [".label", ".btn"]);
    expect(ordered.map((target) => target.selector)).toEqual([".label", ".btn"]);
  });
});

describe("draw path resolution", () => {
  it("returns only selected paths — unselected canvas paths are not targets", () => {
    const canvas = [{ id: "a" }, { id: "b" }] as SVGPathElement[];
    expect(resolveActiveDrawPaths([])).toEqual([]);
    const selected = [canvas[1]];
    expect(resolveActiveDrawPaths(selected)).toEqual(selected);
  });

  it("syncs only selected paths into a draft", () => {
    const canvas = [
      mockDrawPath("#0D99FF"),
      mockDrawPath("#FF6B6B"),
      mockDrawPath("#51CF66"),
    ];
    const selected = [canvas[0], canvas[2]];
    const synced = syncDrawingTargetsInDraft(
      {
        position: { x: 0, y: 0 },
        type: "area",
        fromDrawing: true,
        spanMentionCount: 0,
        elementInfo: {
          tagName: "drawing",
          componentName: null,
          componentPath: [],
          classes: [],
          textContent: null,
          selectedElements: [],
        },
      },
      resolveActiveDrawPaths(selected),
      canvas,
    );

    expect(getDraftElementTargets(synced).map((target) => target.selector)).toEqual([
      "tuna-drawing:1",
      "tuna-drawing:3",
    ]);
    expect(getDraftElementTargets(synced).map((target) => target.mentionColor)).toEqual([
      "#0D99FF",
      "#51CF66",
    ]);
    expect(synced.spanMentionCount).toBe(2);
  });

  it("captures drawing geometry from selected SVG paths", () => {
    const canvas = [mockDrawPath("#0D99FF", undefined, { left: 12, top: 24, width: 100, height: 50 })];
    const [target] = buildDrawingTargetsFromPaths(canvas, canvas);

    expect(target?.drawing).toEqual({
      orderIndex: 1,
      pathData: "M 10 20 L 40 60 Z",
      stroke: "#0D99FF",
      fill: "none",
      bounds: { x: 12, y: 24, width: 100, height: 50 },
      pageBounds: { x: 12, y: 24, width: 100, height: 50 },
    });
  });

  it("clears drawing mentions when selection becomes empty", () => {
    const canvas = [mockDrawPath("#0D99FF"), mockDrawPath("#FF6B6B")];
    const synced = syncDrawingTargetsInDraft(
      {
        position: { x: 0, y: 0 },
        type: "area",
        fromDrawing: true,
        spanMentionCount: 2,
        elementInfo: {
          tagName: "drawing",
          componentName: "Drawing 1",
          componentPath: [],
          classes: [],
          textContent: null,
          selectedElements: [
            { tagName: "drawing", selector: "tuna-drawing:1", componentName: "Drawing 1", componentPath: [], classes: [], textContent: null },
            { tagName: "drawing", selector: "tuna-drawing:2", componentName: "Drawing 2", componentPath: [], classes: [], textContent: null },
          ],
        },
      },
      resolveActiveDrawPaths([]),
      canvas,
    );

    expect(getDraftElementTargets(synced)).toEqual([]);
    expect(synced.spanMentionCount).toBe(0);
  });
});

describe("comment target resolution", () => {
  it("treats an explicit empty selectedElements array as no targets", () => {
    const resolved = getCommentElementTargets({
      tagName: "button",
      componentName: "Button",
      componentPath: ["Hero", "Button"],
      classes: ["btn"],
      textContent: "Save",
      source: "Hero.tsx:12",
      domPath: "body > button",
      selectedElements: [],
    }, ".btn");

    expect(resolved).toEqual([]);
  });

  it("falls back to a single legacy target when selectedElements is absent", () => {
    const resolved = getCommentElementTargets({
      tagName: "button",
      componentName: "Button",
      componentPath: ["Hero", "Button"],
      classes: ["btn"],
      textContent: "Save",
      source: "Hero.tsx:12",
      domPath: "body > button",
    }, ".btn");

    expect(resolved).toEqual([{
      tagName: "button",
      selector: ".btn",
      componentName: "Button",
      componentPath: ["Hero", "Button"],
      classes: ["btn"],
      textContent: "Save",
      source: "Hero.tsx:12",
      domPath: "body > button",
    }]);
  });

  it("syncs inspected element targets while preserving drawing targets", () => {
    const drawingTarget = buildDrawingCommentTarget(1);
    const synced = syncElementTargetsInDraft(
      {
        position: { x: 0, y: 0 },
        type: "area",
        spanMentionCount: 1,
        elementInfo: {
          tagName: "drawing",
          componentName: "Drawing 1",
          componentPath: [],
          classes: [],
          textContent: null,
          selectedElements: [drawingTarget],
        },
      },
      [
        inspectedElement(".btn", "button", ["Hero", "Button"]),
        inspectedElement(".label", "span", ["Hero", "Label"]),
      ],
    );

    expect(synced.spanMentionCount).toBe(3);
    expect(synced.elementInfo?.tagName).toBe("button");
    expect(synced.elementInfo?.componentName).toBe("Button");
    expect(getDraftElementTargets(synced).map((target) => target.selector)).toEqual([
      ".btn",
      ".label",
      "tuna-drawing:1",
    ]);
  });

  it("clears selected targets through the shared draft application path", () => {
    const synced = syncDrawingTargetsInDraft(
      {
        position: { x: 0, y: 0 },
        type: "area",
        spanMentionCount: 1,
        elementInfo: {
          tagName: "drawing",
          componentName: "Drawing 1",
          componentPath: [],
          classes: [],
          textContent: null,
          selectedElements: [buildDrawingCommentTarget(1)],
        },
      },
      [],
      [],
    );

    expect(synced.spanMentionCount).toBe(0);
    expect(synced.elementInfo?.selectedElements).toEqual([]);
  });

  it("clears mixed element and drawing targets through the shared draft application path", () => {
    const synced = applyTargetsToDraft(
      {
        position: { x: 0, y: 0 },
        type: "area",
        spanMentionCount: 2,
        elementInfo: {
          tagName: "button",
          componentName: "Button",
          componentPath: ["Hero", "Button"],
          classes: ["btn"],
          textContent: "Save",
          selectedElements: [
            {
              tagName: "button",
              selector: ".btn",
              componentName: "Button",
              componentPath: ["Hero", "Button"],
              classes: ["btn"],
              textContent: "Save",
            },
            buildDrawingCommentTarget(1),
          ],
        },
      },
      [],
    );

    expect(synced.spanMentionCount).toBe(0);
    expect(getDraftElementTargets(synced)).toEqual([]);
  });
});

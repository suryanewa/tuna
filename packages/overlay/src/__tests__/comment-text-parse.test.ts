import { describe, expect, it } from "vitest";
import {
  buildDrawingCommentTarget,
  buildDrawingTargetsFromPaths,
  getDrawingMentionName,
  getDrawingOrderIndex,
  getMentionName,
  orderTargetsBySelectors,
  parseCommentTextIntoParts,
  areDraftElementTargetsEqual,
  getCommentElementTargets,
  getDraftElementTargets,
  syncElementTargetsInDraft,
  syncDrawingTargetsInDraft,
} from "../overlay/comment/comment-draft";
import type { InspectedElement } from "../types";

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
});

describe("drawing mention names", () => {
  it("names drawings by creation order", () => {
    const paths = [{}, {}, {}] as SVGPathElement[];
    expect(getDrawingOrderIndex(paths[1], paths)).toBe(2);
    expect(getDrawingMentionName(2)).toBe("Drawing 2");
    expect(buildDrawingCommentTarget(2)).toEqual({
      tagName: "drawing",
      selector: "retune-drawing:2",
      componentName: "Drawing 2",
      componentPath: [],
      classes: [],
      textContent: null,
    });
    expect(getMentionName("drawing", "Drawing 2")).toBe("Drawing 2");
  });

  it("syncs multi-selected drawings into an open draft", () => {
    const paths = [{}, {}, {}] as SVGPathElement[];
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

    expect(buildDrawingTargetsFromPaths([paths[0], paths[2]], paths)).toEqual([
      buildDrawingCommentTarget(1),
      buildDrawingCommentTarget(3),
    ]);
    expect(synced.spanMentionCount).toBe(3);
    expect(synced.elementInfo?.selectedElements).toEqual([
      {
        tagName: "button",
        selector: ".btn",
        componentName: "Button",
        classes: [],
        textContent: "Save",
      },
      buildDrawingCommentTarget(1),
      buildDrawingCommentTarget(3),
    ]);
    expect(areDraftElementTargetsEqual(
      [{ tagName: "button", selector: ".btn", componentName: "Button", componentPath: [], classes: [], textContent: "Save" }],
      [{ tagName: "button", selector: ".btn", componentName: "Button", componentPath: [], classes: [], textContent: "Save" }],
    )).toBe(true);
  });
});

describe("orderTargetsBySelectors", () => {
  it("keeps only selectors from the snapshot in document order", () => {
    const ordered = orderTargetsBySelectors(targets, [".label", ".btn"]);
    expect(ordered.map((target) => target.selector)).toEqual([".label", ".btn"]);
  });
});

describe("comment target resolution", () => {
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
      "retune-drawing:1",
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
});

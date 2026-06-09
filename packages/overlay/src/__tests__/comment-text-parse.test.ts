import { describe, expect, it } from "vitest";
import { orderTargetsBySelectors, parseCommentTextIntoParts } from "../overlay/comment/comment-draft";

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

describe("orderTargetsBySelectors", () => {
  it("keeps only selectors from the snapshot in document order", () => {
    const ordered = orderTargetsBySelectors(targets, [".label", ".btn"]);
    expect(ordered.map((target) => target.selector)).toEqual([".label", ".btn"]);
  });
});

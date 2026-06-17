import { describe, expect, it } from "vitest";
import {
  getPlainTextFromEditableHtml,
  setElementPlainTextWithLineBreaks,
} from "../overlay/text-editing";

describe("getPlainTextFromEditableHtml", () => {
  it("preserves editable line breaks as plain text newlines", () => {
    expect(getPlainTextFromEditableHtml("First<br>Second</div><div>Third")).toBe("First\nSecond\nThird");
  });

  it("decodes literal markup without keeping HTML tags", () => {
    expect(getPlainTextFromEditableHtml("&lt;strong&gt;Keep text&lt;/strong&gt;")).toBe("<strong>Keep text</strong>");
  });
});

describe("setElementPlainTextWithLineBreaks", () => {
  it("renders literal markup as text nodes, not HTML", () => {
    const nodes: Array<{ type: "text" | "element"; value: string }> = [];
    const element = {
      ownerDocument: {
        createElement: (tagName: string) => ({ type: "element" as const, value: tagName }),
        createTextNode: (text: string) => ({ type: "text" as const, value: text }),
      },
      replaceChildren: (...children: typeof nodes) => {
        nodes.push(...children);
      },
    } as unknown as HTMLElement;

    setElementPlainTextWithLineBreaks(element, "Use <strong>text</strong>\nNext");

    expect(nodes).toEqual([
      { type: "text", value: "Use <strong>text</strong>" },
      { type: "element", value: "br" },
      { type: "text", value: "Next" },
    ]);
  });
});

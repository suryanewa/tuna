import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommentStore } from "../engine/comment-store";
import {
  applyTextTransaction,
  buildMentionInsertionParts,
  commentToDoc,
  createDocFromLeadingMentions,
  createDocFromTargets,
  docToLexicalParts,
  docToMentionSelectors,
  docToPlainText,
  docToTargets,
  docToUserText,
  getDoc,
  insertMentionsIntoDoc,
  lexicalSnapshotToDoc,
  migrateCommentIfNeeded,
  partsToDoc,
  validateDoc,
} from "../overlay/comment/comment-doc";

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

describe("comment-doc transforms", () => {
  it("converts legacy comment text and targets to doc", () => {
    const doc = commentToDoc({
      text: "@Button @Label align these",
      elementInfo: { selectedElements: targets } as never,
    });
    expect(docToPlainText(doc)).toBe("@Button @Label align these");
    expect(docToMentionSelectors(doc)).toEqual([".btn", ".label"]);
    expect(docToUserText(doc)).toBe("align these");
  });

  it("round-trips doc to plain text and back", () => {
    const original = commentToDoc({
      text: "Fix @Button and @Label spacing",
      elementInfo: { selectedElements: targets } as never,
    });
    const plain = docToPlainText(original);
    const roundTripped = commentToDoc({
      text: plain,
      elementInfo: { selectedElements: docToTargets(original, targets) } as never,
    });
    expect(docToPlainText(roundTripped)).toBe(plain);
    expect(docToMentionSelectors(roundTripped)).toEqual(docToMentionSelectors(original));
  });

  it("docToLexicalParts maps label to name", () => {
    const doc = partsToDoc([
      { type: "mention", mention: { name: "Button", color: "#f00", selector: ".btn" } },
      { type: "text", text: " hello" },
    ]);
    const lexical = docToLexicalParts(doc);
    expect(lexical[0]).toEqual({
      type: "mention",
      mention: { name: "Button", color: "#f00", selector: ".btn" },
    });
  });

  it("lexicalSnapshotToDoc preserves mention order from explicit parts", () => {
    const doc = lexicalSnapshotToDoc(
      {
        text: "@Label @Button fix",
        userText: "fix",
        mentionSelectors: [".label", ".btn"],
        parts: [
          { type: "text", text: " " },
          { type: "mention", mention: { name: "Label", color: "#111", selector: ".label" } },
          { type: "text", text: " " },
          { type: "mention", mention: { name: "Button", color: "#222", selector: ".btn" } },
          { type: "text", text: " fix" },
        ],
      },
      targets,
    );
    expect(docToMentionSelectors(doc)).toEqual([".label", ".btn"]);
    expect(doc.blocks[0].children[2]).toEqual({ type: "text", text: " " });
  });

  it("createDocFromLeadingMentions stores mentions without standalone spacer blocks", () => {
    const doc = createDocFromLeadingMentions(
      [
        { name: "Button", color: "#111", selector: ".btn" },
        { name: "Label", color: "#222", selector: ".label" },
      ],
      "align",
    );
    expect(doc.blocks[0].children).toEqual([
      { type: "mention", mention: { selector: ".btn", label: "Button", color: "#111" } },
      { type: "mention", mention: { selector: ".label", label: "Label", color: "#222" } },
      { type: "text", text: "align" },
    ]);
    expect(docToPlainText(doc)).toBe("@Button@Labelalign");
  });

  it("buildMentionInsertionParts returns a single mention part", () => {
    expect(buildMentionInsertionParts({ name: "Button", color: "#111", selector: ".btn" })).toEqual([
      { type: "mention", mention: { name: "Button", color: "#111", selector: ".btn" } },
    ]);
  });

  it("insertMentionsIntoDoc inserts mentions without standalone spacer blocks", () => {
    const base = partsToDoc([{ type: "text", text: "hello" }]);
    const updated = insertMentionsIntoDoc(base, [{ name: "Button", color: "#111", selector: ".btn" }], 1);
    expect(updated.blocks[0].children).toEqual([
      { type: "text", text: "hello" },
      { type: "mention", mention: { selector: ".btn", label: "Button", color: "#111" } },
    ]);
    expect(docToPlainText(updated)).toBe("hello@Button");
  });

  it("docToTargets prunes to doc mention order", () => {
    const doc = commentToDoc({
      text: "@Button only",
      elementInfo: { selectedElements: targets } as never,
    });
    expect(docToTargets(doc, targets)).toEqual([targets[0]]);
  });

  it("createDocFromLeadingMentions seeds new drafts", () => {
    const doc = createDocFromLeadingMentions(
      [{ name: "Button", color: "#111", selector: ".btn" }],
      "",
    );
    expect(docToPlainText(doc)).toBe("@Button");
    expect(validateDoc(doc).valid).toBe(true);
  });

  it("createDocFromTargets uses span count", () => {
    const doc = createDocFromTargets(targets, 2, "align");
    expect(docToPlainText(doc)).toBe("@Button@Labelalign");
  });

  it("applyTextTransaction appends to trailing text", () => {
    const doc = createDocFromLeadingMentions(
      [{ name: "Button", color: "#111", selector: ".btn" }],
      "",
    );
    const updated = applyTextTransaction(doc, { insert: "hello" });
    expect(docToUserText(updated)).toBe("hello");
  });

  it("validateDoc allows mention-ending documents", () => {
    const doc = partsToDoc([
      { type: "mention", mention: { name: "Button", color: "#111", selector: ".btn" } },
    ]);
    const result = validateDoc(doc);
    expect(result.valid).toBe(true);
  });

  it("getDoc prefers stored content", () => {
    const content = createDocFromLeadingMentions(
      [{ name: "Button", color: "#111", selector: ".btn" }],
      "saved",
    );
    const comment = {
      id: 1,
      text: "@Button saved",
      content,
      position: { x: 0, y: 0 },
      type: "element" as const,
      timestamp: 1,
    };
    expect(getDoc(comment)).toEqual(content);
  });

  it("migrateCommentIfNeeded builds content from legacy", () => {
    const migrated = migrateCommentIfNeeded({
      id: 1,
      text: "@Button hello",
      position: { x: 0, y: 0 },
      type: "element",
      elementInfo: { selectedElements: [targets[0]] } as never,
      timestamp: 1,
    });
    expect(migrated.content?.version).toBe(1);
    expect(migrated.text).toBe("@Button hello");
  });
});

describe("CommentStore dual-write", () => {
  it("derives text from content on add", () => {
    const store = new CommentStore();
    const content = createDocFromLeadingMentions(
      [{ name: "Button", color: "#111", selector: ".btn" }],
      "fix spacing",
    );
    const comment = store.addWithDoc(content, { x: 0, y: 0 }, "element", {
      elementInfo: {
        tagName: "button",
        componentName: "Button",
        componentPath: [],
        classes: [],
        textContent: null,
        selectedElements: [targets[0]],
      },
    });
    expect(comment.content).toEqual(content);
    expect(comment.text).toBe("@Buttonfix spacing");
  });

  it("updateContent patches content text and targets atomically", () => {
    const store = new CommentStore();
    store.add("original", { x: 0, y: 0 }, "element", {
      elementInfo: {
        tagName: "button",
        componentName: "Button",
        componentPath: [],
        classes: [],
        textContent: null,
        selectedElements: targets,
      },
    });
    const content = createDocFromLeadingMentions(
      [{ name: "Button", color: "#111", selector: ".btn" }],
      "edited",
    );
    const updated = store.updateContent(1, content, [targets[0]]);
    expect(updated).toBe(true);
    const comment = store.get(1);
    expect(comment?.text).toBe("@Buttonedited");
    expect(comment?.content).toEqual(content);
    expect(comment?.elementInfo?.selectedElements).toEqual([targets[0]]);
  });

  describe("restore migrates legacy comments", () => {
    const storage = new Map<string, string>();

    beforeEach(() => {
      vi.stubGlobal("localStorage", {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      });
    });

    afterEach(() => {
      storage.clear();
      vi.unstubAllGlobals();
    });

    it("migrates content on restore", () => {
      const store = new CommentStore();
      const legacy = {
        comments: [
          {
            id: 1,
            text: "@Button hello",
            position: { x: 0, y: 0 },
            type: "element",
            elementInfo: {
              tagName: "button",
              componentName: "Button",
              componentPath: [],
              classes: [],
              textContent: null,
              selectedElements: [targets[0]],
            },
            timestamp: 1,
          },
        ],
        nextId: 2,
      };
      storage.set("tuna-comments", JSON.stringify(legacy));
      store.restore();
      const comment = store.get(1);
      expect(comment?.content?.version).toBe(1);
      expect(comment?.text).toBe("@Button hello");
    });
  });
});

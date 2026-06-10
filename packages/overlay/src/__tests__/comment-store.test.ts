import { describe, it, expect, beforeEach } from "vitest";
import { CommentStore, type Comment } from "../engine/comment-store";

describe("CommentStore", () => {
  let store: CommentStore;

  beforeEach(() => {
    store = new CommentStore();
  });

  describe("add", () => {
    it("creates an element comment with correct fields", () => {
      const comment = store.add("fix this", { x: 100, y: 200 }, "element", {
        selector: ".btn",
        elementInfo: {
          tagName: "button",
          componentName: "Button",
          componentPath: [],
          classes: ["btn", "btn-primary"],
          textContent: "Click me",
        },
      });
      expect(comment.id).toBe(1);
      expect(comment.text).toBe("fix this");
      expect(comment.position).toEqual({ x: 100, y: 200 });
      expect(comment.type).toBe("element");
      expect(comment.selector).toBe(".btn");
      expect(comment.elementInfo?.tagName).toBe("button");
      expect(comment.elementInfo?.componentName).toBe("Button");
      expect(comment.timestamp).toBeGreaterThan(0);
    });

    it("creates an area comment with bounding box", () => {
      const comment = store.add("add section here", { x: 300, y: 400 }, "area", {
        area: { x: 100, y: 200, width: 400, height: 300 },
      });
      expect(comment.type).toBe("area");
      expect(comment.area).toEqual({ x: 100, y: 200, width: 400, height: 300 });
    });

    it("increments IDs", () => {
      const c1 = store.add("first", { x: 0, y: 0 }, "element");
      const c2 = store.add("second", { x: 0, y: 0 }, "element");
      expect(c1.id).toBe(1);
      expect(c2.id).toBe(2);
    });

    it("stores anchorOffset for element comments", () => {
      const comment = store.add("test", { x: 150, y: 250 }, "element", {
        anchorOffset: { x: 50, y: 30 },
      });
      expect(comment.anchorOffset).toEqual({ x: 50, y: 30 });
    });
  });

  describe("update", () => {
    it("updates comment text", () => {
      store.add("original", { x: 0, y: 0 }, "element");
      const updated = store.update(1, "changed");
      expect(updated).toBe(true);
      expect(store.get(1)?.text).toBe("changed");
    });

    it("returns false for non-existent comment", () => {
      expect(store.update(99, "nope")).toBe(false);
    });

    it("updates timestamp on edit", () => {
      const comment = store.add("test", { x: 0, y: 0 }, "element");
      const originalTs = comment.timestamp;
      // Small delay to ensure different timestamp
      store.update(1, "edited");
      expect(store.get(1)?.timestamp).toBeGreaterThanOrEqual(originalTs);
    });
  });

  describe("patch", () => {
    it("updates area metadata through the store API", () => {
      store.add("area", { x: 10, y: 20 }, "area", {
        area: { x: 0, y: 0, width: 100, height: 100 },
        elementInfo: {
          tagName: "area",
          componentName: null,
          componentPath: [],
          classes: [],
          textContent: null,
          containedElements: [],
        },
      });

      const patched = store.patch(1, {
        position: { x: 120, y: 140 },
        area: { x: 0, y: 0, width: 120, height: 140 },
        elementInfo: {
          tagName: "area",
          componentName: null,
          componentPath: [],
          classes: [],
          textContent: null,
          containedElements: [
            { tagName: "button", selector: ".btn", componentName: "Button", textContent: "Save" },
          ],
        },
      });

      expect(patched).toBe(true);
      expect(store.get(1)?.position).toEqual({ x: 120, y: 140 });
      expect(store.get(1)?.area).toEqual({ x: 0, y: 0, width: 120, height: 140 });
      expect(store.get(1)?.elementInfo?.containedElements).toEqual([
        { tagName: "button", selector: ".btn", componentName: "Button", textContent: "Save" },
      ]);
    });

    it("returns false for non-existent comments", () => {
      expect(store.patch(99, { text: "missing" })).toBe(false);
    });
  });

  describe("delete", () => {
    it("removes a comment", () => {
      store.add("to delete", { x: 0, y: 0 }, "element");
      expect(store.count).toBe(1);
      const deleted = store.delete(1);
      expect(deleted).toBe(true);
      expect(store.count).toBe(0);
      expect(store.get(1)).toBeUndefined();
    });

    it("returns false for non-existent comment", () => {
      expect(store.delete(99)).toBe(false);
    });
  });

  describe("getAll", () => {
    it("returns comments sorted by ID", () => {
      store.add("third", { x: 0, y: 0 }, "element");
      store.add("first", { x: 0, y: 0 }, "element");
      store.add("second", { x: 0, y: 0 }, "element");
      const all = store.getAll();
      expect(all.map(c => c.id)).toEqual([1, 2, 3]);
    });

    it("returns empty array when no comments", () => {
      expect(store.getAll()).toEqual([]);
    });
  });

  describe("getBySelector", () => {
    it("filters by selector", () => {
      store.add("on btn", { x: 0, y: 0 }, "element", { selector: ".btn" });
      store.add("on header", { x: 0, y: 0 }, "element", { selector: ".header" });
      store.add("on btn again", { x: 0, y: 0 }, "element", { selector: ".btn" });
      const btnComments = store.getBySelector(".btn");
      expect(btnComments).toHaveLength(2);
      expect(btnComments.map(c => c.text)).toEqual(["on btn", "on btn again"]);
    });
  });

  describe("clear", () => {
    it("removes all comments and resets IDs", () => {
      store.add("a", { x: 0, y: 0 }, "element");
      store.add("b", { x: 0, y: 0 }, "element");
      store.clear();
      expect(store.count).toBe(0);
      expect(store.getAll()).toEqual([]);
      // IDs reset
      const c = store.add("new", { x: 0, y: 0 }, "element");
      expect(c.id).toBe(1);
    });
  });

  describe("count", () => {
    it("tracks comment count", () => {
      expect(store.count).toBe(0);
      store.add("a", { x: 0, y: 0 }, "element");
      expect(store.count).toBe(1);
      store.add("b", { x: 0, y: 0 }, "element");
      expect(store.count).toBe(2);
      store.delete(1);
      expect(store.count).toBe(1);
    });
  });

  describe("selectedElements for element comments", () => {
    it("stores all selected element targets", () => {
      const comment = store.add("align these", { x: 10, y: 20 }, "element", {
        selector: ".btn",
        elementInfo: {
          tagName: "button",
          componentName: "Button",
          componentPath: ["Hero", "Button"],
          classes: ["btn"],
          textContent: "Get Started",
          selectedElements: [
            {
              tagName: "button",
              selector: ".btn",
              componentName: "Button",
              componentPath: ["Hero", "Button"],
              classes: ["btn"],
              textContent: "Get Started",
              source: "Hero.tsx:12",
            },
            {
              tagName: "span",
              selector: ".label",
              componentName: "Label",
              classes: ["label"],
              textContent: "Beta",
            },
          ],
        },
      });
      expect(comment.elementInfo?.selectedElements).toHaveLength(2);
      expect(comment.elementInfo?.selectedElements?.[1].selector).toBe(".label");
    });
  });

  describe("containedElements for area comments", () => {
    it("stores contained elements info", () => {
      const comment = store.add("multi select", { x: 0, y: 0 }, "area", {
        area: { x: 100, y: 100, width: 300, height: 200 },
        elementInfo: {
          tagName: "area",
          componentName: "App",
          componentPath: [],
          classes: [],
          textContent: null,
          containedElements: [
            { tagName: "div", selector: ".card", componentName: "Card", textContent: "Hello" },
            { tagName: "p", selector: "p", componentName: null, textContent: "World" },
          ],
        },
      });
      expect(comment.elementInfo?.containedElements).toHaveLength(2);
      expect(comment.elementInfo?.containedElements?.[0].selector).toBe(".card");
    });
  });
});
